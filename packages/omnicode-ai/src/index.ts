/**
 * @omnicode/ai – AI agent framework for code review and issue triage.
 *
 * Provides base agent classes, a registry, and concrete agent implementations
 * for code-review analysis and issue triage automation.
 *
 * ## Usage
 *
 * ```ts
 * import { AgentRegistry } from "@omnicode/ai";
 * import { CodeReviewAgent } from "@omnicode/ai/review";
 * import { IssueTriageAgent } from "@omnicode/ai/triage";
 *
 * const registry = new AgentRegistry();
 * registry.register(new CodeReviewAgent());
 * registry.register(new IssueTriageAgent());
 *
 * const result = await registry.dispatch("code-review", reviewContext);
 * ```
 *
 * @module
 */

// Core framework
export { Agent } from "./Agent.ts";
export type { AgentConfig } from "./Agent.ts";
export { AgentRegistry, RegistryError } from "./AgentRegistry.ts";

// Shared types
export type {
  AgentDescriptor,
  AgentLifecycle,
  AgentResult,
  AgentType,
  Version,
  ReviewSeverity,
  FileChange,
  ReviewComment,
  ReviewContext,
  ReviewOutput,
  ExistingComment,
  IssueType,
  Priority,
  TriageContext,
  TriageOutput,
} from "./types.ts";
