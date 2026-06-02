/**
 * IssuesSidebar — Slide-out panel showing GitHub issues for the current repo.
 *
 * Follows the DiffPanel / DiffPanelShell pattern: renders as a border-left
 * sidebar that can be toggled from the ChatHeader toolbar.
 *
 * Auto-detects the current project's git remote and fetches open issues
 * via the OmniCode server API.
 */

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

export interface IssuesSidebarData {
  readonly owner: string;
  readonly repo: string;
  readonly issues: GitHubIssue[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly refreshedAt: string | null;
}

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

type IssueFilter = "all" | "open" | "closed";
type IssueType = "all" | "bug" | "feature" | "other";

const ISSUE_LABEL_FILTERS: Record<IssueType, (labels: ReadonlyArray<{ name: string }>) => boolean> = {
  all: () => true,
  bug: (labels) => labels.some((l) => /bug/i.test(l.name)),
  feature: (labels) => labels.some((l) => /feature|enhancement|feat/i.test(l.name)),
  other: (labels) => !labels.some((l) => /bug|feature|enhancement|feat/i.test(l.name)),
};

// ---------------------------------------------------------------------------
// Helper: determine issue type icon
// ---------------------------------------------------------------------------

function getIssueIcon(labels: ReadonlyArray<{ name: string }>): ReactNode {
  const labelNames = labels.map((l) => l.name.toLowerCase());
  if (labelNames.some((n) => /bug/i.test(n))) {
    return <BugIcon className="size-3.5 shrink-0 text-red-500" />;
  }
  if (labelNames.some((n) => /feature|enhancement|feat/i.test(n))) {
    return <LightbulbIcon className="size-3.5 shrink-0 text-amber-500" />;
  }
  return <AlertTriangleIcon className="size-3.5 shrink-0 text-muted-foreground" />;
}

// ---------------------------------------------------------------------------
// IssuesSidebar component
// ---------------------------------------------------------------------------

interface IssuesSidebarProps {
  mode?: DiffPanelMode;
  cwd: string | null;
  environmentId: string | null;
}

export default function IssuesSidebar({
  mode = "inline",
  cwd,
  environmentId: _environmentId,
}: IssuesSidebarProps) {
  const [data, setData] = useState<IssuesSidebarData>({
    owner: "",
    repo: "",
    issues: [],
    loading: false,
    error: null,
    refreshedAt: null,
  });
  const [filter, setFilter] = useState<IssueFilter>("open");
  const [typeFilter, setTypeFilter] = useState<IssueType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [repoInfo, setRepoInfo] = useState<{ owner: string; repo: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Step 1: detect repo from cwd
  const detectRepo = useCallback(async () => {
    if (!cwd) return;
    try {
      const resp = await fetch(
        `/api/omnicode/projects/detect-remote?cwd=${encodeURIComponent(cwd)}`,
      );
      if (!resp.ok) return;
      const body = await resp.json();
      if (!body.hasRemote || !body.remoteUrl) {
        setData((prev) => ({ ...prev, error: "No git remote detected for this project." }));
        return;
      }
      // Parse remote URL: git@github.com:owner/repo.git or https://github.com/owner/repo
      const urlStr: string = body.remoteUrl;
      let owner = "";
      let repo = "";
      const sshMatch = urlStr.match(/github\.com[:/]([^/]+)\/([^/.]+)(?:\.git)?$/);
      const httpsMatch = urlStr.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?$/);
      const match = sshMatch || httpsMatch;
      if (match) {
        owner = match[1];
        repo = match[2];
      }
      if (owner && repo) {
        setRepoInfo({ owner, repo });
      } else {
        setData((prev) => ({ ...prev, error: `Could not parse remote URL: ${urlStr}` }));
      }
    } catch {
      setData((prev) => ({ ...prev, error: "Failed to detect repo remote." }));
    }
  }, [cwd]);

  // Step 2: fetch issues once repo is known
  const fetchIssues = useCallback(async () => {
    if (!repoInfo) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const resp = await fetch(
        `/api/omnicode/issues?owner=${encodeURIComponent(repoInfo.owner)}&repo=${encodeURIComponent(repoInfo.repo)}&state=all&perPage=50`,
        { signal: controller.signal },
      );

      if (!resp.ok) {
        setData((prev) => ({
          ...prev,
          loading: false,
          error: `API error: ${resp.status} ${resp.statusText}`,
        }));
        return;
      }

      const rawIssues: unknown[] = await resp.json();
      const issues: GitHubIssue[] = rawIssues.map((issue: Record<string, unknown>) => ({
        number: issue.number as number,
        title: issue.title as string,
        state: issue.state as "open" | "closed",
        htmlUrl: issue.htmlUrl as string ?? (issue.html_url as string) ?? "",
        labels: Array.isArray(issue.labels)
          ? issue.labels.map((l: Record<string, unknown>) => ({
              name: String(l.name ?? ""),
              color: String(l.color ?? "ccc"),
            }))
          : [],
        createdAt: issue.createdAt as string ?? (issue.created_at as string) ?? "",
        updatedAt: issue.updatedAt as string ?? (issue.updated_at as string) ?? "",
        author: issue.author as string ?? (issue.user?.login as string) ?? "unknown",
        commentsCount: (issue.commentsCount ?? issue.comments ?? 0) as number,
        body: issue.body as string ?? undefined,
      }));

      setData({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
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
  }, [repoInfo]);

  // Detect repo when cwd changes
  useEffect(() => {
    setRepoInfo(null);
    setData({
      owner: "",
      repo: "",
      issues: [],
      loading: false,
      error: null,
      refreshedAt: null,
    });
    void detectRepo();
  }, [detectRepo, cwd]);

  // Fetch issues when repo is detected
  useEffect(() => {
    void fetchIssues();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchIssues]);

  // Derived state
  const filteredIssues = useMemo(() => {
    let result = data.issues;

    // State filter
    if (filter === "open") {
      result = result.filter((i) => i.state === "open");
    } else if (filter === "closed") {
      result = result.filter((i) => i.state === "closed");
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((i) => ISSUE_LABEL_FILTERS[typeFilter](i.labels));
    }

    // Text search
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
            {/* State pills */}
            <div className="flex items-center gap-1">
              {(["open", "closed", "all"] as const).map((f) => {
                const count = f === "open" ? openCount : f === "closed" ? closedCount : data.issues.length;
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
            {/* Type chips */}
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
            {/* Search */}
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
          {/* Loading skeleton */}
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

          {/* Error state */}
          {data.error && !data.loading && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <TriangleAlertIcon className="size-8 text-amber-500" />
              <p className="text-xs text-muted-foreground">{data.error}</p>
              {cwd && (
                <Button variant="outline" size="xs" onClick={detectRepo}>
                  Retry detection
                </Button>
              )}
            </div>
          )}

          {/* Empty state */}
          {!data.loading && !data.error && filteredIssues.length === 0 && data.issues.length > 0 && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <SearchIcon className="size-6 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">
                No issues match your filters.
              </p>
            </div>
          )}

          {/* No issues state */}
          {!data.loading && !data.error && data.issues.length === 0 && repoInfo && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <CheckCircle2Icon className="size-8 text-green-500" />
              <p className="text-xs text-muted-foreground">
                No open issues!
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                All clear in <span className="font-medium">{repoInfo.owner}/{repoInfo.repo}</span>
              </p>
            </div>
          )}

          {/* No repo state */}
          {!data.loading && !data.error && data.issues.length === 0 && !repoInfo && cwd && (
            <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
              <GitPullRequestIcon className="size-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">
                No GitHub repo detected for this project.
              </p>
              <p className="text-[10px] text-muted-foreground/60">
                Issues sidebar requires a GitHub remote URL.
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
                <span className="text-[9px] text-muted-foreground/50">
                  {issue.author}
                </span>
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
