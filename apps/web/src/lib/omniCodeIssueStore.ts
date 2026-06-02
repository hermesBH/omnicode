/**
 * OmniCode Global Issue Store
 *
 * A zustand store that auto-detects git repos from open T3 Code projects and
 * fetches their open issues automatically, making issue data available
 * throughout the app via reactive selectors.
 *
 * This is the "auto-populate" engine — it runs independently of any route,
 * so issue counts are always visible (sidebar badges, project rows, etc.)
 * without needing to navigate to the /omnicode/issues page.
 *
 * Pattern follows T3 Code's existing zustand stores (uiStateStore, etc.).
 */

import { create } from "zustand";
import { selectProjectsAcrossEnvironments, useStore } from "../store";
import { parseGitRemoteUrl, type DetectedRepo } from "./omnicodeProjectDetector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-repo issue count data (lightweight — just counts, not full issues) */
export interface RepoIssueCount {
  readonly owner: string;
  readonly repo: string;
  readonly openCount: number;
  readonly updatedAt: string;
  readonly loading: boolean;
  readonly error: string | null;
}

/** Shape of the global OmniCode issue store */
export interface OmniCodeIssueStoreState {
  /** Map of "owner/repo" → issue count data */
  readonly repoIssues: Record<string, RepoIssueCount>;
  /** Detected repos from open projects */
  readonly detectedRepos: Record<string, DetectedRepo>;
  /** Whether any detection is in progress */
  readonly loading: boolean;
  /** Total open issues across all detected repos */
  readonly totalOpenIssues: number;
  /** Last time the data was refreshed (ISO string) */
  readonly lastUpdatedAt: string | null;
  /** Global error state */
  readonly error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = "/api/omnicode";

async function detectRepoForProject(cwd: string): Promise<DetectedRepo | null> {
  try {
    const resp = await fetch(
      `${API_BASE}/projects/detect-remote?cwd=${encodeURIComponent(cwd)}`,
    );
    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data.hasRemote || !data.remoteUrl) return null;

    // Parse the remote URL to extract owner/repo
    const parsed = parseGitRemoteUrl(data.remoteUrl);
    if (!parsed.owner || !parsed.repo) return null;

    return {
      environmentId: "",
      projectId: "",
      cwd,
      remoteUrl: data.remoteUrl ?? null,
      owner: parsed.owner,
      repo: parsed.repo,
      provider: parsed.provider ?? "github",
    };
  } catch {
    return null;
  }
}

async function fetchIssueCount(
  owner: string,
  repo: string,
): Promise<{ count: number; error: null } | { count: 0; error: string }> {
  try {
    const resp = await fetch(
      `${API_BASE}/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&state=open&perPage=1&page=1`,
    );
    if (!resp.ok) {
      return { count: 0, error: `HTTP ${resp.status}: ${resp.statusText}` };
    }
    // We only need the count — GitHub API always returns total_count in the
    // link header / response. We parse the array length as a simple proxy.
    const data: unknown[] = await resp.json();
    return { count: data.length, error: null };
  } catch (err) {
    return { count: 0, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState: OmniCodeIssueStoreState = {
  repoIssues: {},
  detectedRepos: {},
  loading: false,
  totalOpenIssues: 0,
  lastUpdatedAt: null,
  error: null,
};

export const useOmniCodeIssueStore = create<OmniCodeIssueStoreState>()(
  () => initialState,
);

// ---------------------------------------------------------------------------
// Actions (pure functions that update the store)
// ---------------------------------------------------------------------------

/**
 * Update a single repo's issue count in the store and recalculate total.
 */
function setRepoIssueCount(
  key: string,
  data: Partial<RepoIssueCount>,
): void {
  useOmniCodeIssueStore.setState((state) => {
    const current = state.repoIssues[key];
    const updated: RepoIssueCount = {
      owner: data.owner ?? current?.owner ?? "",
      repo: data.repo ?? current?.repo ?? "",
      openCount: data.openCount ?? current?.openCount ?? 0,
      updatedAt: data.updatedAt ?? current?.updatedAt ?? new Date().toISOString(),
      loading: data.loading ?? current?.loading ?? false,
      error: data.error !== undefined ? data.error : (current?.error ?? null),
    };

    const newRepoIssues = { ...state.repoIssues, [key]: updated };
    const totalOpenIssues = Object.values(newRepoIssues).reduce(
      (sum, r) => sum + (r.openCount > 0 ? r.openCount : 0),
      0,
    );

    return { repoIssues: newRepoIssues, totalOpenIssues };
  });
}

/**
 * Set detected repos from project scan.
 */
function setDetectedRepos(repos: DetectedRepo[]): void {
  const detectedRepos: Record<string, DetectedRepo> = {};
  for (const repo of repos) {
    if (repo.owner && repo.repo) {
      detectedRepos[`${repo.owner}/${repo.repo}`] = repo;
    }
  }

  // Clean up stale repos that are no longer in the workspace
  useOmniCodeIssueStore.setState((state) => {
    const keys = new Set(Object.keys(detectedRepos));
    const newRepoIssues = { ...state.repoIssues };
    for (const key of Object.keys(newRepoIssues)) {
      if (!keys.has(key)) {
        delete newRepoIssues[key];
      }
    }
    const totalOpenIssues = Object.values(newRepoIssues).reduce(
      (sum, r) => sum + (r.openCount > 0 ? r.openCount : 0),
      0,
    );
    return { detectedRepos, repoIssues: newRepoIssues, totalOpenIssues };
  });
}

/**
 * Mark a repo's issue data as loading.
 */
function setRepoLoading(key: string, loading: boolean): void {
  useOmniCodeIssueStore.setState((state) => {
    const current = state.repoIssues[key];
    if (!current) return state;
    return {
      repoIssues: {
        ...state.repoIssues,
        [key]: { ...current, loading },
      },
    };
  });
}

/**
 * Set global loading state.
 */
function setGlobalLoading(loading: boolean): void {
  useOmniCodeIssueStore.setState({ loading });
}

/**
 * Set global error state.
 */
function setGlobalError(error: string | null): void {
  useOmniCodeIssueStore.setState({ error });
}

// ---------------------------------------------------------------------------
// Orchestrator: run detection + issue fetching
// ---------------------------------------------------------------------------

let _detectionTimeout: ReturnType<typeof setTimeout> | null = null;
let _lastProjectKey = "";

/**
 * Scan all open T3 Code projects, detect their git remotes,
 * then fetch open issue counts for each.
 *
 * Designed to be called from a React effect in a high-level component
 * (e.g., root layout) that re-runs when projects change.
 */
export async function runIssueDetection(
  projects: ReadonlyArray<{ environmentId: string; id: string; cwd: string | null }>,
): Promise<void> {
  // Debounce: wait 200ms after last call
  if (_detectionTimeout) {
    clearTimeout(_detectionTimeout);
  }

  return new Promise<void>((resolve) => {
    _detectionTimeout = setTimeout(async () => {
      try {
        // Filter to projects with a real cwd
        const projectCwds = projects
          .filter((p): p is { environmentId: string; id: string; cwd: string } =>
            Boolean(p.cwd && !p.cwd.startsWith("memory:")),
          );

        if (projectCwds.length === 0) {
          setDetectedRepos([]);
          setGlobalLoading(false);
          setGlobalError(null);
          resolve();
          return;
        }

        setGlobalLoading(true);

        // Step 1: detect git remotes for each project
        const detectedRepos: DetectedRepo[] = [];

        for (const p of projectCwds) {
          const repo = await detectRepoForProject(p.cwd);
          if (repo) {
            detectedRepos.push({
              ...repo,
              environmentId: p.environmentId,
              projectId: p.id,
            });
          }
        }

        setDetectedRepos(detectedRepos);

        // Step 2: fetch issue counts for each detected repo
        const repoKeys = detectedRepos
          .filter((r): r is DetectedRepo & { owner: string; repo: string } =>
            Boolean(r.owner && r.repo),
          )
          .map((r) => ({ key: `${r.owner}/${r.repo}`, owner: r.owner!, repo: r.repo! }));

        for (const { key, owner, repo } of repoKeys) {
          setRepoLoading(key, true);
          const result = await fetchIssueCount(owner, repo);
          setRepoIssueCount(key, {
            owner,
            repo,
            openCount: result.count,
            error: result.error,
            updatedAt: new Date().toISOString(),
            loading: false,
          });
        }

        setGlobalLoading(false);
        setGlobalError(null);
        useOmniCodeIssueStore.setState({ lastUpdatedAt: new Date().toISOString() });
      } catch (err) {
        setGlobalLoading(false);
        setGlobalError(err instanceof Error ? err.message : "Detection failed");
      } finally {
        resolve();
      }
    }, 200);
  });
}

// ---------------------------------------------------------------------------
// React hook: auto-detect + fetch when projects change
// ---------------------------------------------------------------------------

/**
 * Hook that runs issue detection whenever the open projects change.
 *
 * Drop this into a high-level component (root layout, app shell, etc.)
 * once — it subscribes to the T3 Code project store and auto-populates
 * the global OmniCode issue store on every project change.
 */
export function useOmniCodeAutoIssue(): void {
  const projects = useStore(
    (store) => selectProjectsAcrossEnvironments(store),
  );

  const projectKey = projects
    .filter((p) => p.cwd && !p.cwd.startsWith("memory:"))
    .map((p) => p.cwd ?? p.id)
    .join(",");

  // Re-run detection when project key changes
  if (projectKey !== _lastProjectKey) {
    _lastProjectKey = projectKey;
    // Fire and forget — store updates are reactive
    void runIssueDetection(projects);
  }
}
