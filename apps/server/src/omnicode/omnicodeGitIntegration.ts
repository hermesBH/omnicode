/**
 * OmniCode VCS Integration Service
 *
 * Provides git worktree creation, remote URL detection, and branching
 * services that integrate deeply with T3 Code's project system.
 *
 * Instead of depending on T3 Code's internal VcsDriver (which lives in
 * apps/server/), this service shells out to git directly via the Effect
 * ChildProcessSpawner — keeping OmniCode self-contained while still
 * operating inside the same Effect/DI context as the rest of the server.
 *
 * @module omnicodeGitIntegration
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as ParseResult from "effect/ParseResult";
import { ChildProcessSpawner } from "effect/unstable/process";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Input for creating an issue-based worktree.
 */
export const CreateIssueWorktreeInput = Schema.Struct({
  /** Absolute path to the git repository */
  cwd: Schema.String,
  /** GitHub issue number */
  issueNumber: Schema.Number,
  /** Issue title (used to derive branch name) */
  issueTitle: Schema.String,
  /** Repository owner (for branch naming) */
  owner: Schema.String,
  /** Repository name (for branch naming) */
  repo: Schema.String,
});
export type CreateIssueWorktreeInput = typeof CreateIssueWorktreeInput.Type;

/**
 * Result of creating an issue-based worktree.
 */
export const CreateIssueWorktreeResult = Schema.Struct({
  /** The branch name created */
  branch: Schema.String,
  /** Absolute path to the worktree */
  worktreePath: Schema.String,
  /** The base git directory of the repo */
  gitDir: Schema.String,
});
export type CreateIssueWorktreeResult = typeof CreateIssueWorktreeResult.Type;

/**
 * Detected project repo info.
 */
export const DetectedProjectRepo = Schema.Struct({
  environmentId: Schema.String,
  projectId: Schema.String,
  cwd: Schema.String,
  projectName: Schema.String,
  remoteUrl: Schema.String,
  owner: Schema.String,
  repo: Schema.String,
  provider: Schema.String,
});
export type DetectedProjectRepo = typeof DetectedProjectRepo.Type;

/**
 * Input for detecting remote info from a project directory.
 */
export const DetectRemoteInput = Schema.Struct({
  cwd: Schema.String,
});
export type DetectRemoteInput = typeof DetectRemoteInput.Type;

/**
 * Result of detecting remote info.
 */
export const DetectRemoteResult = Schema.Struct({
  hasRemote: Schema.Boolean,
  remoteUrl: Schema.Option(Schema.String),
  owner: Schema.Option(Schema.String),
  repo: Schema.Option(Schema.String),
  provider: Schema.Option(Schema.String),
});
export type DetectRemoteResult = typeof DetectRemoteResult.Type;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Sanitize an arbitrary string into a valid git branch name fragment.
 */
function sanitizeBranchFragment(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/^[.\s_/-]+|[.\s_/-]+$/g, "");

  const branchFragment = normalized
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/-+/g, "-")
    .replace(/^[.\/_-]+|[.\/_-]+$/g, "")
    .slice(0, 64)
    .replace(/[.\/_-]+$/g, "");

  return branchFragment.length > 0 ? branchFragment : "issue";
}

/**
 * Build a branch name from an issue number and title.
 * Pattern: `feature/issues/${issueNumber}-${sanitized-title}`
 */
function buildIssueBranchName(issueNumber: number, issueTitle: string): string {
  const titleSlug = sanitizeBranchFragment(issueTitle).slice(0, 48);
  return `feature/issues/${issueNumber}-${titleSlug}`;
}

/**
 * Build a worktree directory name from a branch name.
 * Pattern: `.worktrees/${branchName}`
 */
function buildWorktreeDir(branch: string, gitDir: string): string {
  const safeBranch = branch.replace(/\//g, "-");
  return `${gitDir}/../.worktrees/${safeBranch}`;
}

/**
 * Parse a git remote URL into owner/repo/provider components.
 * Supports GitHub, GitLab, Bitbucket, Azure DevOps.
 */
function parseRemoteUrl(remoteUrl: string): {
  owner: string;
  repo: string;
  provider: string;
} | null {
  const trimmed = remoteUrl.trim();

  // GitHub: git@github.com:owner/repo.git or https://github.com/owner/repo.git
  const githubMatch =
    /^(?:git@github\.com:|https?:\/\/github\.com\/|git:\/\/github\.com\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(
      trimmed,
    );
  if (githubMatch) {
    return { owner: githubMatch[1], repo: githubMatch[2].replace(/\.git$/, ""), provider: "github" };
  }

  // GitLab: git@gitlab.com:owner/repo.git or https://gitlab.com/owner/repo.git
  const gitlabMatch =
    /^(?:git@gitlab\.com:|https?:\/\/gitlab\.com\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(trimmed);
  if (gitlabMatch) {
    return { owner: gitlabMatch[1], repo: gitlabMatch[2].replace(/\.git$/, ""), provider: "gitlab" };
  }

  // Bitbucket: git@bitbucket.org:owner/repo.git or https://bitbucket.org/owner/repo.git
  const bbMatch =
    /^(?:git@bitbucket\.org:|https?:\/\/bitbucket\.org\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i.exec(trimmed);
  if (bbMatch) {
    return { owner: bbMatch[1], repo: bbMatch[2].replace(/\.git$/, ""), provider: "bitbucket" };
  }

  // Azure DevOps: https://dev.azure.com/org/project/_git/repo
  const azureMatch =
    /^https?:\/\/dev\.azure\.com\/([^/\s]+)\/[^/\s]+\/_git\/([^/\s]+?)\/?$/i.exec(trimmed);
  if (azureMatch) {
    return { owner: azureMatch[1], repo: azureMatch[2].replace(/\.git$/, ""), provider: "azure-devops" };
  }

  return null;
}

// =============================================================================
// VcsIntegration Service
// =============================================================================

/**
 * Shape for the VcsIntegration Effect service.
 */
export interface VcsIntegrationShape {
  /**
   * Detect git remote info for a project directory.
   */
  readonly detectRemote: (
    input: DetectRemoteInput,
  ) => Effect.Effect<DetectRemoteResult>;

  /**
   * Create a git worktree for an issue.
   */
  readonly createIssueWorktree: (
    input: CreateIssueWorktreeInput,
  ) => Effect.Effect<CreateIssueWorktreeResult>;

  /**
   * Fetch the default branch name for a repo.
   */
  readonly getDefaultBranch: (
    cwd: string,
  ) => Effect.Effect<string, Error>;

  /**
   * Check if a worktree already exists for a branch.
   */
  readonly worktreeExists: (
    cwd: string,
    branch: string,
  ) => Effect.Effect<boolean>;

  /**
   * List existing worktree paths.
   */
  readonly listWorktrees: (
    cwd: string,
  ) => Effect.Effect<ReadonlyArray<{ path: string; branch: string }>>;
}

/**
 * Context tag for the VcsIntegration service.
 */
export class VcsIntegrationService extends Context.Service<
  VcsIntegrationService,
  VcsIntegrationShape
>()("@omnicode/server/VcsIntegration") {}

// =============================================================================
// Implementation helpers
// =============================================================================

/**
 * Run git with args in a given directory, return stdout.
 */
function gitRun(
  spawner: ChildProcessSpawner.ChildProcessSpawner,
  cwd: string,
  args: ReadonlyArray<string>,
  timeoutMs = 30_000,
): Effect.Effect<string, Error> {
  return Effect.gen(function* () {
    const process = yield* spawner.spawn("git", args, {
      cwd,
      stdio: "pipe",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });

    const exitCode = yield* process.wait(timeoutMs);
    const stdout = yield* process.stdout.string();
    const stderr = yield* process.stderr.string();

    if (exitCode !== 0) {
      return yield* Effect.fail(
        new Error(`git ${args[0] ?? ""} failed: ${stderr.trim() || stdout.trim()}`),
      );
    }

    return stdout.trim();
  });
}

// =============================================================================
// VcsIntegration Live Layer
// =============================================================================

/**
 * Live implementation of VcsIntegrationService.
 *
 * Requires ChildProcessSpawner from the Effect platform, which is
 * provided by the runtime (available in both Bun and Node contexts).
 */
export const VcsIntegrationLive: Layer.Layer<
  VcsIntegrationService,
  never,
  typeof ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(
  VcsIntegrationService,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const shape: VcsIntegrationShape = {
      detectRemote: (input) =>
        Effect.gen(function* () {
          // Try to get the remote URL
          const remoteUrlOrError = yield* Effect.either(
            gitRun(spawner, input.cwd, [
              "config",
              "--get",
              "remote.origin.url",
            ]),
          );

          if (Effect.isFailure(remoteUrlOrError)) {
            return {
              hasRemote: false,
              remoteUrl: { _tag: "None" },
              owner: { _tag: "None" },
              repo: { _tag: "None" },
              provider: { _tag: "None" },
            };
          }

          const remoteUrl = remoteUrlOrError.value;
          const parsed = parseRemoteUrl(remoteUrl);

          if (!parsed) {
            return {
              hasRemote: true,
              remoteUrl: { _tag: "Some", value: remoteUrl },
              owner: { _tag: "None" },
              repo: { _tag: "None" },
              provider: { _tag: "None" },
            };
          }

          return {
            hasRemote: true,
            remoteUrl: { _tag: "Some", value: remoteUrl },
            owner: { _tag: "Some", value: parsed.owner },
            repo: { _tag: "Some", value: parsed.repo },
            provider: { _tag: "Some", value: parsed.provider },
          };
        }).pipe(
          Effect.catchAll((err) =>
            Effect.succeed({
              hasRemote: false,
              remoteUrl: { _tag: "None" },
              owner: { _tag: "None" },
              repo: { _tag: "None" },
              provider: { _tag: "None" },
            } as DetectRemoteResult),
          ),
        ),

      getDefaultBranch: (cwd) =>
        gitRun(spawner, cwd, [
          "rev-parse",
          "--abbrev-ref",
          "HEAD",
        ]).pipe(
          Effect.catchAll(() =>
            gitRun(spawner, cwd, [
              "symbolic-ref",
              "refs/remotes/origin/HEAD",
            ]).pipe(
              Effect.map((ref) =>
                ref.replace(/^refs\/remotes\/origin\//, "").trim(),
              ),
            ),
          ),
        ),

      worktreeExists: (cwd, branch) =>
        Effect.gen(function* () {
          const result = yield* Effect.either(
            gitRun(spawner, cwd, ["worktree", "list", "--porcelain"]),
          );
          if (Effect.isFailure(result)) {
            return false;
          }
          return result.value.includes(`branch refs/heads/${branch}`);
        }),

      listWorktrees: (cwd) =>
        Effect.gen(function* () {
          const output = yield* gitRun(spawner, cwd, [
            "worktree",
            "list",
            "--porcelain",
          ]);
          const worktrees: Array<{ path: string; branch: string }> = [];
          let currentPath = "";
          let currentBranch = "";

          for (const line of output.split("\n")) {
            if (line.startsWith("worktree ")) {
              currentPath = line.slice(9).trim();
            } else if (line.startsWith("branch ")) {
              currentBranch = line
                .slice(7)
                .trim()
                .replace(/^refs\/heads\//, "");
              if (currentPath && currentBranch) {
                worktrees.push({
                  path: currentPath,
                  branch: currentBranch,
                });
              }
              currentPath = "";
              currentBranch = "";
            }
          }

          return worktrees;
        }),

      createIssueWorktree: (input) =>
        Effect.gen(function* () {
          const { cwd, issueNumber, issueTitle } = input;

          // Verify it's a git repo
          const gitDirResult = yield* Effect.either(
            gitRun(spawner, cwd, ["rev-parse", "--git-dir"]),
          );
          if (Effect.isFailure(gitDirResult)) {
            return yield* Effect.fail(
              new Error(`Not a git repository: ${cwd}`),
            );
          }
          const gitDir = gitDirResult.value;

          // Get git root (top-level worktree)
          const gitRoot = yield* gitRun(spawner, cwd, [
            "rev-parse",
            "--show-toplevel",
          ]);

          // Build branch name
          const branch = buildIssueBranchName(issueNumber, issueTitle);

          // Check if branch already exists locally or remotely
          const branchExists = yield* Effect.either(
            gitRun(spawner, cwd, ["rev-parse", "--verify", `refs/heads/${branch}`]),
          );

          if (Effect.isSuccess(branchExists)) {
            // Branch already exists — just switch to it or return existing
            const wtPath = buildWorktreeDir(branch, gitRoot);
            return {
              branch,
              worktreePath: wtPath,
              gitDir,
            };
          }

          // Fetch latest from origin
          yield* Effect.ignore(
            gitRun(spawner, cwd, ["fetch", "origin"], 15_000),
          );

          // Create the branch from origin/main (or fallback to HEAD)
          const defaultBranch = yield* Effect.ignore(
            shape.getDefaultBranch(cwd),
          );

          const branchBase = defaultBranch.pipe(
            Effect.match({
              onSuccess: (name) => `origin/${name}`,
              onFailure: () => "HEAD",
            }),
          );

          const branchBaseValue = yield* branchBase;

          yield* gitRun(spawner, cwd, [
            "branch",
            branch,
            branchBaseValue,
          ]).pipe(
            Effect.catchAll(() =>
              gitRun(spawner, cwd, ["branch", branch, "HEAD"]),
            ),
          );

          // Create the worktree
          const wtPath = buildWorktreeDir(branch, gitRoot);

          yield* gitRun(spawner, cwd, [
            "worktree",
            "add",
            wtPath,
            branch,
          ]);

          return {
            branch,
            worktreePath: wtPath,
            gitDir,
          };
        }).pipe(
          Effect.catchAll((err) =>
            Effect.fail(
              err instanceof Error
                ? err
                : new Error(`Failed to create issue worktree: ${String(err)}`),
            ),
          ),
        ),
    };

    return shape;
  }),
);
