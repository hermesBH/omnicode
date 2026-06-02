import * as Schema from "effect/Schema";

// ---------------------------------------------------------------------------
// Agent Execution Request
// ---------------------------------------------------------------------------

/**
 * The kind of agent to execute.
 */
export const AgentKind = Schema.Literals(["code-review", "issue-triage", "custom"]);
export type AgentKind = typeof AgentKind.Type;

/**
 * Request to execute an agent.
 */
export const AgentExecutionRequest = Schema.Struct({
  agentKind: AgentKind,
  task: Schema.String,
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  model: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  cwd: Schema.optional(Schema.String),
});
export type AgentExecutionRequest = typeof AgentExecutionRequest.Type;

// ---------------------------------------------------------------------------
// Agent Execution Result
// ---------------------------------------------------------------------------

/**
 * Agent execution lifecycle status.
 */
export const AgentStatus = Schema.Literals(["pending", "running", "completed", "failed"]);
export type AgentStatus = typeof AgentStatus.Type;

/**
 * Result of an agent execution.
 */
export const AgentExecutionResult = Schema.Struct({
  agentKind: AgentKind,
  success: Schema.Boolean,
  status: AgentStatus,
  output: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.String),
  durationMs: Schema.Number,
  startedAt: Schema.optional(Schema.String),
  completedAt: Schema.optional(Schema.String),
});
export type AgentExecutionResult = typeof AgentExecutionResult.Type;

// ---------------------------------------------------------------------------
// Agent Info
// ---------------------------------------------------------------------------

/**
 * Agent capability descriptor.
 */
export const AgentCapability = Schema.Literals([
  "code-review",
  "issue-triage",
  "pr-analysis",
  "code-generation",
  "testing",
  "documentation",
  "security-analysis",
]);
export type AgentCapability = typeof AgentCapability.Type;

/**
 * Metadata about a registered agent.
 */
export const AgentInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  version: Schema.String,
  capabilities: Schema.optional(Schema.Array(AgentCapability)),
  model: Schema.optional(Schema.String),
  enabled: Schema.Boolean,
});
export type AgentInfo = typeof AgentInfo.Type;
