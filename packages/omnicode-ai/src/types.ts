/**
 * Shared types for the @omnicode/ai agent framework.
 *
 * Provides base types for agents, review results, and triage results,
 * following Effect-inspired patterns for structured results and composability.
 */

// ---------------------------------------------------------------------------
// Agent metadata
// ---------------------------------------------------------------------------

/**
 * Unique identifier for an agent within a registry.
 * Convention: lowercase kebab-case, e.g. "code-review", "issue-triage".
 */
export type AgentType = string;

/**
 * Semantic version string (MAJOR.MINOR.PATCH).
 */
export type Version = string;

/**
 * Descriptor every agent must provide.
 */
export interface AgentDescriptor {
  readonly type: AgentType;
  readonly name: string;
  readonly description: string;
  readonly version: Version;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Lifecycle phases an agent moves through.
 */
export type AgentLifecycle =
  | "idle"
  | "initializing"
  | "ready"
  | "running"
  | "completed"
  | "failed"
  | "cleanedUp";

/**
 * Result of a single agent execution.
 */
export interface AgentResult<TOutput = unknown> {
  readonly agent: AgentType;
  readonly success: boolean;
  readonly output: TOutput;
  readonly durationMs: number;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Review types
// ---------------------------------------------------------------------------

/**
 * Severity level for a review comment.
 */
export type ReviewSeverity = "error" | "warning" | "info" | "suggestion";

/**
 * A single file change in a pull-request diff.
 */
export interface FileChange {
  /** Path relative to repository root, e.g. "src/index.ts" */
  readonly path: string;
  /** Unified diff content (the raw diff lines) */
  readonly diff: string;
  /** Status of the file in the PR */
  readonly status: "added" | "modified" | "deleted" | "renamed";
  /** Old path (only for renames) */
  readonly previousPath?: string;
}

/**
 * Full context for a code-review invocation.
 */
export interface ReviewContext {
  /** Repository owner/name like "owner/repo" */
  readonly repo: string;
  /** Pull-request number */
  readonly prNumber: number;
  /** PR title */
  readonly title: string;
  /** PR description / body */
  readonly description: string;
  /** The files changed in this PR */
  readonly files: ReadonlyArray<FileChange>;
  /** Comments already posted on the PR (for de-duplication) */
  readonly existingComments: ReadonlyArray<ExistingComment>;
  /** Base branch (target of the PR) */
  readonly baseBranch: string;
  /** Head branch (source of the PR) */
  readonly headBranch: string;
}

/**
 * A comment that already exists on the PR.
 */
export interface ExistingComment {
  readonly id: string;
  readonly body: string;
  readonly author: string;
  readonly filePath?: string;
  readonly line?: number;
}

/**
 * A single review comment produced by an agent.
 */
export interface ReviewComment {
  readonly filePath: string;
  readonly line: number;
  readonly severity: ReviewSeverity;
  readonly message: string;
  readonly rule?: string;
  readonly suggestion?: string;
}

/**
 * Structured output from a code-review run.
 */
export interface ReviewOutput {
  readonly summary: string;
  readonly comments: ReadonlyArray<ReviewComment>;
  readonly filesReviewed: number;
  readonly issuesFound: number;
}

// ---------------------------------------------------------------------------
// Triage types
// ---------------------------------------------------------------------------

/**
 * Category of an issue.
 */
export type IssueType =
  | "bug"
  | "feature"
  | "enhancement"
  | "documentation"
  | "question"
  | "refactor"
  | "performance"
  | "security"
  | "other";

/**
 * Priority level for an issue.
 */
export type Priority = "critical" | "high" | "medium" | "low";

/**
 * Context for a triage invocation.
 */
export interface TriageContext {
  /** Repository owner/name like "owner/repo" */
  readonly repo: string;
  /** Issue number */
  readonly issueNumber: number;
  /** Issue title */
  readonly title: string;
  /** Issue body / description */
  readonly body: string;
  /** Labels already applied to the issue */
  readonly existingLabels: ReadonlyArray<string>;
  /** Issue author username */
  readonly author: string;
}

/**
 * Structured output from a triage run.
 */
export interface TriageOutput {
  readonly issueType: IssueType;
  readonly suggestedLabels: ReadonlyArray<string>;
  readonly suggestedAssignees: ReadonlyArray<string>;
  readonly priority: Priority;
  readonly confidence: number; // 0.0 – 1.0
  readonly reasoning: string;
}


