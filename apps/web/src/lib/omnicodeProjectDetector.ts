/**
 * OmniCode Project Detector
 *
 * React hook + utilities that tap into T3 Code's existing store to
 * auto-detect git remotes for all open projects. When a project's
 * working directory has a GitHub remote, the detector:
 *   - Extracts owner/repo from the remote URL
 *   - Fetches open issues and PRs via the OmniCode REST API
 *   - Provides a click handler that creates a worktree + chat thread
 *
 * This hooks into the existing `selectProjectsAcrossEnvironments`
 * selector and VCS status store so detection is fully automatic.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectProjectsAcrossEnvironments, useStore } from "../store";
import { useVcsStatus } from "./vcsStatusState";
import { useNewThreadHandler } from "../hooks/useHandleNewThread";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A detected git repository from a T3 Code project */
export interface DetectedRepo {
  /** The T3 Code environment ID */
  environmentId: string;
  /** The T3 Code project ID */
  projectId: string;
  /** Absolute path to the project root */
  cwd: string;
  /** Full remote URL (e.g. git@github.com:owner/repo.git) */
  remoteUrl: string | null;
  /** Extracted owner (e.g. "facebook") */
  owner: string | null;
  /** Extracted repo name (e.g. "react") */
  repo: string | null;
  /** Provider (e.g. "github", "gitlab") */
  provider: string | null;
}

/** An issue fetched from the GitHub API */
export interface OmniCodeIssue {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  labels: Array<{ name: string; color: string }>;
  createdAt: string;
  updatedAt: string;
  user: { login: string; avatarUrl?: string } | null;
  body?: string | null;
}

/** A pull request fetched from the GitHub API */
export interface OmniCodePullRequest {
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
  user: { login: string; avatarUrl?: string } | null;
  draft: boolean;
}

/** Combined detection result */
export interface OmniCodeProjectStatus {
  repo: DetectedRepo;
  issues: OmniCodeIssue[];
  pulls: OmniCodePullRequest[];
  loading: boolean;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract owner/repo from a git remote URL.
 * Handles both HTTPS and SSH formats.
 */
export function parseGitRemoteUrl(url: string): {
  owner: string | null;
  repo: string | null;
  provider: string | null;
} {
  if (!url) return { owner: null, repo: null, provider: null };

  // Determine provider
  let provider: string | null = null;
  if (url.includes("github.com")) provider = "github";
  else if (url.includes("gitlab.com") || url.includes("gitlab."))
    provider = "gitlab";
  else if (url.includes("bitbucket.org")) provider = "bitbucket";
  else provider = "git";

  // Try SSH format: git@github.com:owner/repo.git
  const sshMatch = url.match(
    /(?:git@|https?:\/\/)[^\/]+[:/]([^\/]+)\/([^\/]+?)(?:\.git)?$/,
  );
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2].replace(/\.git$/, ""),
      provider,
    };
  }

  // Try HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = url.match(
    /https?:\/\/(?:[^@]+@)?[^\/]+\/([^\/]+)\/([^\/]+?)(?:\.git)?$/,
  );
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2].replace(/\.git$/, ""),
      provider,
    };
  }

  return { owner: null, repo: null, provider };
}

/**
 * Detect the remote URL for a project by calling the OmniCode server API.
 * Falls back to extracting from the VCS status if the API is unavailable.
 */
export async function detectRemoteForProject(
  cwd: string,
): Promise<{ remoteUrl: string | null; owner: string | null; repo: string | null; provider: string | null }> {
  try {
    const resp = await fetch(
      `/api/omnicode/projects/detect-remote?cwd=${encodeURIComponent(cwd)}`,
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.hasRemote && data.remoteUrl) {
        return {
          remoteUrl: data.remoteUrl,
          owner: data.owner ?? null,
          repo: data.repo ?? null,
          provider: data.provider ?? null,
        };
      }
      return { remoteUrl: null, owner: null, repo: null, provider: null };
    }
  } catch {
    // API unavailable — fall back to remote URL from VCS status
  }
  return { remoteUrl: null, owner: null, repo: null, provider: null };
}

/**
 * Fetch open issues for a repository via the OmniCode API.
 */
export async function fetchIssues(
  owner: string,
  repo: string,
): Promise<OmniCodeIssue[]> {
  const resp = await fetch(
    `/api/omnicode/issues?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&state=open&sort=updated&direction=desc&perPage=25`,
  );
  if (!resp.ok) throw new Error(`Failed to fetch issues: ${resp.statusText}`);
  return (await resp.json()) as OmniCodeIssue[];
}

/**
 * Create a worktree for an issue via the OmniCode API.
 */
export async function createIssueWorktree(input: {
  cwd: string;
  issueNumber: number;
  issueTitle: string;
  owner: string;
  repo: string;
}): Promise<{ branch: string; worktreePath: string; gitDir: string }> {
  const resp = await fetch("/api/omnicode/worktree", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create worktree: ${text}`);
  }
  return await resp.json();
}

// ---------------------------------------------------------------------------
// Hook: useOmniCodeProjectDetector
// ---------------------------------------------------------------------------

/**
 * Auto-detect git repositories for all open T3 Code projects.
 *
 * Returns an array of `DetectedRepo` objects with extracted owner/repo info.
 * Re-detects when projects change.
 */
export function useOmniCodeProjectDetector(): DetectedRepo[] {
  const projects = useStore(
    useShallow((store) => selectProjectsAcrossEnvironments(store)),
  );
  const [detectedRepos, setDetectedRepos] = useState<DetectedRepo[]>([]);

  useEffect(() => {
    const projectCwds = projects
      .filter((p) => p.cwd && !p.cwd.startsWith("memory:"))
      .map((p) => ({
        environmentId: p.environmentId,
        projectId: p.id,
        cwd: p.cwd!,
      }));

    if (projectCwds.length === 0) {
      setDetectedRepos([]);
      return;
    }

    let cancelled = false;

    async function detect() {
      const results: DetectedRepo[] = [];

      for (const p of projectCwds) {
        // Check VCS status first (fast, doesn't require server roundtrip)
        const { remoteUrl, owner, repo, provider } = await detectRemoteForProject(p.cwd);

        if (remoteUrl && owner && repo) {
          results.push({
            environmentId: p.environmentId,
            projectId: p.projectId,
            cwd: p.cwd,
            remoteUrl,
            owner,
            repo,
            provider,
          });
        }
      }

      if (!cancelled) {
        setDetectedRepos(results);
      }
    }

    void detect();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  return detectedRepos;
}

// ---------------------------------------------------------------------------
// Hook: useOmniCodeIssueData
// ---------------------------------------------------------------------------

/**
 * Fetch issues and PRs for an array of detected repos.
 * Returns a Map keyed by `${owner}/${repo}`.
 */
export function useOmniCodeIssueData(
  repos: DetectedRepo[],
): Map<string, OmniCodeProjectStatus> {
  const [statuses, setStatuses] = useState<Map<string, OmniCodeProjectStatus>>(
    () => new Map(),
  );
  const prevRepoKey = useRef<string>("");

  const repoKey = useMemo(
    () => repos.map((r) => `${r.owner}/${r.repo}`).join(","),
    [repos],
  );

  useEffect(() => {
    if (repoKey === prevRepoKey.current) return;
    prevRepoKey.current = repoKey;

    if (repos.length === 0) {
      setStatuses(new Map());
      return;
    }

    let cancelled = false;

    async function fetchAll() {
      const newMap = new Map<string, OmniCodeProjectStatus>();

      for (const repo of repos) {
        if (!repo.owner || !repo.repo) continue;
        const key = `${repo.owner}/${repo.repo}`;

        newMap.set(key, {
          repo,
          issues: [],
          pulls: [],
          loading: true,
          error: null,
        });
      }

      if (!cancelled) setStatuses(new Map(newMap));

      for (const repo of repos) {
        if (!repo.owner || !repo.repo) continue;
        const key = `${repo.owner}/${repo.repo}`;

        try {
          const [issues] = await Promise.all([
            fetchIssues(repo.owner, repo.repo),
            // PRs will be added in a future iteration
          ]);

          if (!cancelled) {
            newMap.set(key, {
              repo,
              issues,
              pulls: [],
              loading: false,
              error: null,
            });
            setStatuses(new Map(newMap));
          }
        } catch (err) {
          if (!cancelled) {
            newMap.set(key, {
              repo,
              issues: [],
              pulls: [],
              loading: false,
              error: err instanceof Error ? err.message : "Unknown error",
            });
            setStatuses(new Map(newMap));
          }
        }
      }
    }

    void fetchAll();

    return () => {
      cancelled = true;
    };
  }, [repoKey, repos]);

  return statuses;
}

// ---------------------------------------------------------------------------
// Hook: useOmniCodeWorktreeFlow
// ---------------------------------------------------------------------------

/**
 * Hook that returns a callback to create a worktree + chat thread for an issue.
 *
 * This taps into T3 Code's existing `useNewThreadHandler` to create the chat
 * thread with the worktree attached as context.
 */
export function useOmniCodeWorktreeFlow() {
  const newThreadHandler = useNewThreadHandler();

  const openIssueWorktree = useCallback(
    async (
      repo: DetectedRepo,
      issue: OmniCodeIssue,
      options?: {
        /** Optional branch name suffix (default: issue title slug) */
        branchSuffix?: string;
      },
    ): Promise<{ branch: string; worktreePath: string } | null> => {
      try {
        // 1. Create the git worktree via OmniCode API
        const result = await createIssueWorktree({
          cwd: repo.cwd,
          issueNumber: issue.number,
          issueTitle: issue.title,
          owner: repo.owner!,
          repo: repo.repo!,
        });

        // 2. Create a new chat thread with the worktree context
        //    Use the T3 Code project ref and thread handler
        const projectRef = {
          environmentId: repo.environmentId,
          projectId: repo.projectId,
        };

        await newThreadHandler(projectRef, {
          worktreePath: result.worktreePath,
          branch: result.branch,
        });

        return { branch: result.branch, worktreePath: result.worktreePath };
      } catch (err) {
        console.error("Failed to create issue worktree:", err);
        return null;
      }
    },
    [newThreadHandler],
  );

  return openIssueWorktree;
}
