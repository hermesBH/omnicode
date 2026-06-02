/**
 * IssuesSidebar — Fully client-side GitHub issues sidebar.
 *
 * Detects the repo from T3 Code's existing VCS status store (no server API
 * needed), fetches issues directly from the GitHub REST API (CORS-enabled),
 * and renders clickable issue cards with labels, author, and timestamps.
 *
 * Uses DiffPanelShell for the right-side panel layout, matching the DiffPanel
 * pattern exactly.  Handles loading, error, empty, and no-repo states.
 */

import type { EnvironmentId } from "@t3tools/contracts";
import {
  AlertTriangleIcon,
  BugIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  GitPullRequestIcon,
  LightbulbIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { DiffPanelShell, type DiffPanelMode } from "./DiffPanelShell";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Skeleton } from "./ui/skeleton";
import { cn } from "~/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubIssue {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly htmlUrl: string;
  readonly labels: ReadonlyArray<{ name: string; color: string }>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly author: string;
  readonly commentsCount: number;
  readonly body?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ISSUE_FILTERS: Record<string, (l: ReadonlyArray<{ name: string }>) => boolean> = {
  all: () => true,
  bug: (labels) => labels.some((l) => /bug/i.test(l.name)),
  feature: (labels) => labels.some((l) => /feature|enhancement|feat/i.test(l.name)),
  other: (labels) => !labels.some((l) => /bug|feature|enhancement|feat/i.test(l.name)),
};

function getIssueIcon(labels: ReadonlyArray<{ name: string }>): ReactNode {
  const n = labels.map((l) => l.name.toLowerCase());
  if (n.some((x) => /bug/i.test(x))) return <BugIcon className="size-3.5 shrink-0 text-red-500" />;
  if (n.some((x) => /feature|enhancement/i.test(x))) return <LightbulbIcon className="size-3.5 shrink-0 text-amber-500" />;
  return <AlertTriangleIcon className="size-3.5 shrink-0 text-muted-foreground" />;
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ---------------------------------------------------------------------------
// IssuesSidebar
// ---------------------------------------------------------------------------

interface IssuesSidebarProps {
  mode?: DiffPanelMode;
  cwd: string | null;
  environmentId: string | null;
}

export default function IssuesSidebar({
  mode = "inline",
  cwd,
  environmentId,
}: IssuesSidebarProps) {
  const [data, setData] = useState<{
    owner: string;
    repo: string;
    issues: GitHubIssue[];
    loading: boolean;
    error: string | null;
    refreshedAt: string | null;
  }>({ owner: "", repo: "", issues: [], loading: false, error: null, refreshedAt: null });

  const [filter, setFilter] = useState<"open" | "closed" | "all">("open");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Derive owner/repo — first try OmniCode server API, then fall back to parsing from cwd
  const repoInfo = useMemo(() => {
    // Already resolved via server API in detectRepo
    if (data.owner && data.repo) return { owner: data.owner, repo: data.repo };
    // Fallback: try parsing from cwd path (folder name)
    if (cwd) {
      const parts = cwd.replace(/\/+$/, "").split("/");
      const folder = parts[parts.length - 1];
      if (folder && !folder.startsWith(".")) return { owner: "", repo: folder };
    }
    return null;
  }, [data.owner, data.repo, cwd]);

  // Fetch issues when repo info changes
  const fetchIssues = useCallback(async () => {
    if (!repoInfo) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Step 1: If we don't have owner yet, try the OmniCode detect-remote API
      let owner = repoInfo.owner;
      let repo = repoInfo.repo;

      if (!owner && cwd) {
        try {
          const detectResp = await fetch(
            `/api/omnicode/projects/detect-remote?cwd=${encodeURIComponent(cwd)}`,
            { signal: controller.signal },
          );
          if (detectResp.ok) {
            const detectBody = await detectResp.json();
            if (detectBody.owner && detectBody.repo) {
              owner = detectBody.owner;
              repo = detectBody.repo;
            }
          }
        } catch {
          // API unavailable — fall through with folder-name fallback
        }
      }

      if (!owner || !repo) throw new Error("Could not determine the GitHub repository");

      // Step 2: Fetch issues from GitHub API
      const apiUrl = owner
        ? `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&per_page=50&sort=updated&direction=desc`
        : `https://api.github.com/search/issues?q=repo:${encodeURIComponent(repo)}+is:issue&per_page=50`;

      const resp = await fetch(apiUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "OmniCode-T3Code",
        },
        signal: controller.signal,
      });

      if (!resp.ok) {
        if (resp.status === 404) throw new Error(`Repository "${owner ? `${owner}/` : ""}${repo}" not found or private`);
        if (resp.status === 403) throw new Error("Rate limited by GitHub — try again later");
        throw new Error(`GitHub API error: ${resp.status}`);
      }

      let rawData: Record<string, unknown>[];
      if (owner) {
        rawData = (await resp.json()) as Record<string, unknown>[];
      } else {
        const searchBody = (await resp.json()) as Record<string, unknown>;
        rawData = (searchBody.items ?? []) as Record<string, unknown>[];
      }

      const issues: GitHubIssue[] = rawData
        .filter((item) => !item.pull_request)
        .map((item) => ({
          number: item.number as number,
          title: item.title as string,
          state: (item.state as "open" | "closed") ?? "open",
          htmlUrl: (item.html_url as string) ?? "",
          labels: ((item.labels as Record<string, unknown>[]) ?? []).map((l) => ({
            name: String(l.name ?? ""),
            color: String(l.color ?? "ccc"),
          })),
          createdAt: (item.created_at as string) ?? "",
          updatedAt: (item.updated_at as string) ?? "",
          author: ((item.user as Record<string, unknown>)?.login as string) ?? "unknown",
          commentsCount: (item.comments as number) ?? 0,
          body: (item.body as string) ?? undefined,
        }));

      if (controller.signal.aborted) return;

      setData({
        owner,
        repo,
        issues,
        loading: false,
        error: null,
        refreshedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch issues",
      }));
    }
  }, [repoInfo, cwd]);

  // Fetch on mount and when repo changes
  useEffect(() => {
    setData({ owner: "", repo: "", issues: [], loading: false, error: null, refreshedAt: null });
    if (repoInfo) void fetchIssues();
    return () => abortRef.current?.abort();
  }, [repoInfo, fetchIssues]);

  // Derived: filtered issues
  const filteredIssues = useMemo(() => {
    let result = data.issues;
    if (filter === "open") result = result.filter((i) => i.state === "open");
    else if (filter === "closed") result = result.filter((i) => i.state === "closed");

    if (typeFilter !== "all") result = result.filter((i) => ISSUE_FILTERS[typeFilter]?.(i.labels) ?? true);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.number.toString().includes(q) ||
          i.author.toLowerCase().includes(q),
      );
    }
    return result;
  }, [data.issues, filter, typeFilter, searchQuery]);

  const openCount = data.issues.filter((i) => i.state === "open").length;
  const closedCount = data.issues.filter((i) => i.state === "closed").length;

  // Header row
  const headerRow = (
    <>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GitPullRequestIcon className="size-4 shrink-0" />
        <span className="truncate text-sm font-medium">
          {repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : "Issues"}
        </span>
        {data.loading && (
          <Loader2Icon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        )}
        {data.refreshedAt && !data.loading && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {new Date(data.refreshedAt).toLocaleTimeString()}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          onClick={fetchIssues}
          disabled={data.loading || !repoInfo}
          aria-label="Refresh issues"
          className="size-7"
        >
          <RefreshCwIcon className={cn("size-3.5", data.loading && "animate-spin")} />
        </Button>
        {repoInfo && (
          <Button
            variant="ghost"
            size="xs"
            asChild
            className="size-7"
            aria-label="Open on GitHub"
          >
            <a
              href={`https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon className="size-3.5" />
            </a>
          </Button>
        )}
      </div>
    </>
  );

  return (
    <DiffPanelShell mode={mode} header={headerRow}>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Filter toolbar */}
        {data.issues.length > 0 && (
          <div className="flex flex-col gap-1.5 border-b border-border px-3 py-2">
            <div className="flex items-center gap-1">
              {(["open", "closed", "all"] as const).map((f) => {
                const count =
                  f === "open" ? openCount : f === "closed" ? closedCount : data.issues.length;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                      filter === f
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    {f === "open" && <><CheckCircle2Icon className="mr-1 inline size-2.5 text-green-500" />{count} Open</>}
                    {f === "closed" && <><CheckCircle2Icon className="mr-1 inline size-2.5 text-muted-foreground" />{count} Closed</>}
                    {f === "all" && <>All {count}</>}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1">
              {(["all", "bug", "feature"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider font-medium transition-colors",
                    typeFilter === t
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground/60 hover:text-foreground/80",
                  )}
                >
                  {t === "all" ? "All" : t === "bug" ? "🐛 Bugs" : "💡 Features"}
                </button>
              ))}
            </div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                className="h-7 pl-7 text-xs"
                placeholder="Search issues…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Issue list */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Loading */}
          {data.loading && data.issues.length === 0 && (
            <div className="flex flex-col gap-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1 rounded-md border border-border/40 p-2.5">
                  <Skeleton className="h-3 w-full rounded-full" />
                  <Skeleton className="h-3 w-3/4 rounded-full" />
                  <div className="mt-1 flex gap-1">
                    <Skeleton className="h-4 w-12 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {data.error && !data.loading && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <TriangleAlertIcon className="size-8 text-amber-500" />
              <p className="text-xs text-muted-foreground">{data.error}</p>
              {cwd && (
                <Button variant="outline" size="xs" onClick={fetchIssues}>
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* Empty (filtered) */}
          {!data.loading && !data.error && filteredIssues.length === 0 && data.issues.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <SearchIcon className="size-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No issues match your filters.</p>
            </div>
          )}

          {/* Empty (no issues) */}
          {!data.loading && !data.error && data.issues.length === 0 && repoInfo && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <CheckCircle2Icon className="size-8 text-green-500" />
              <p className="text-xs text-muted-foreground">No issues found!</p>
              <p className="text-[10px] text-muted-foreground/60">
                All clear in <span className="font-medium">{repoInfo.owner}/{repoInfo.repo}</span>
              </p>
            </div>
          )}

          {/* No repo */}
          {!data.loading && !data.error && data.issues.length === 0 && !repoInfo && cwd && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <GitPullRequestIcon className="size-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                No GitHub repo detected.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                Requires a GitHub remote URL in the project's git config.
              </p>
            </div>
          )}

          {/* Issue cards */}
          {filteredIssues.map((issue) => (
            <a
              key={`${issue.number}`}
              href={issue.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col gap-1 border-b border-border/40 px-3 py-2.5 transition-colors hover:bg-accent/30"
            >
              <div className="flex items-start gap-2">
                {getIssueIcon(issue.labels)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-mono tabular-nums",
                        issue.state === "open" ? "text-green-500" : "text-muted-foreground",
                      )}
                    >
                      #{issue.number}
                    </span>
                    <span className="line-clamp-2 text-xs leading-snug group-hover:text-foreground/90">
                      {issue.title}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    {issue.labels.slice(0, 3).map((label) => (
                      <span
                        key={label.name}
                        className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-medium leading-tight"
                        style={{
                          backgroundColor: `#${label.color}22`,
                          color: `#${label.color}`,
                          borderColor: `#${label.color}44`,
                          borderWidth: 1,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                    {issue.labels.length > 3 && (
                      <span className="text-[8px] text-muted-foreground/50">
                        +{issue.labels.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pl-[22px]">
                <span className="text-[9px] text-muted-foreground/50">{issue.author}</span>
                <span className="text-[9px] text-muted-foreground/40">·</span>
                <span className="text-[9px] text-muted-foreground/50">
                  {formatRelativeTime(issue.updatedAt)}
                </span>
                {issue.commentsCount > 0 && (
                  <>
                    <span className="text-[9px] text-muted-foreground/40">·</span>
                    <span className="text-[9px] text-muted-foreground/50">
                      {issue.commentsCount} comments
                    </span>
                  </>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </DiffPanelShell>
  );
}
