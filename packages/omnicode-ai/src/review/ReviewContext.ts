/**
 * Types for PR diff context and code review data.
 *
 * Re-exports the shared types so consumers can import solely from
 * "@omnicode/ai/review" if they prefer.
 */

export type {
  FileChange,
  ReviewContext,
  ReviewComment,
  ReviewOutput,
  ReviewSeverity,
  ExistingComment,
} from "../types.ts";
