/**
 * CodeReviewAgent – analyzes PR diffs and posts structured review comments.
 *
 * The agent inspects file diffs for common issue patterns (debug artifacts,
 * anti-patterns, security concerns, performance pitfalls, style violations)
 * and produces a structured ReviewOutput with comments grouped by severity.
 *
 * This is a reference implementation. Production agents would integrate
 * with language-specific AST parsers or LLM-based analysis.
 */

import { Agent, type AgentConfig } from "../Agent.ts";
import type {
  FileChange,
  ReviewComment,
  ReviewContext,
  ReviewOutput,
  ReviewSeverity,
} from "../types.ts";

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AgentConfig = {
  type: "code-review",
  name: "Code Review Agent",
  description: "Analyzes pull-request diffs and generates structured review comments",
  version: "0.1.0",
};

// ---------------------------------------------------------------------------
// Pattern matchers (simple heuristic-based detection)
// ---------------------------------------------------------------------------

interface IssuePattern {
  severity: ReviewSeverity;
  rule: string;
  test: (file: FileChange, lines: ReadonlyArray<string>) => RegExpExecArray | null;
  message: string;
  suggestion: string;
}

/**
 * Known patterns the agent can detect without external tools.
 * These are illustrative; real-world agents would use AST or ML.
 */
const patterns: ReadonlyArray<IssuePattern> = [
  // ── Debug artifacts ──────────────────────────────────────────────────────
  {
    severity: "warning",
    rule: "no-console-log",
    test: (_f, lines) => {
      for (const line of lines) {
        const m = /console\.(log|debug|info|warn|error)\(/.exec(line);
        if (m) return m;
      }
      return null;
    },
    message: "Console logging statement found",
    suggestion: "Remove or replace with structured logging before merging",
  },
  {
    severity: "error",
    rule: "no-debugger",
    test: (_f, lines) => {
      for (const line of lines) {
        const m = /\bdebugger\b/.exec(line);
        if (m) return m;
      }
      return null;
    },
    message: "`debugger` statement found in source code",
    suggestion: "Remove the debugger statement before committing",
  },
  {
    severity: "warning",
    rule: "no-todo",
    test: (_f, lines) => {
      for (const line of lines) {
        const m = /\/\/\s*TODO/i.exec(line);
        if (m) return m;
      }
      return null;
    },
    message: "TODO comment found",
    suggestion: "Resolve or track the TODO item in your issue tracker",
  },
  // ── Security ────────────────────────────────────────────────────────────
  {
    severity: "error",
    rule: "no-inner-html",
    test: (_f, lines) => {
      for (const line of lines) {
        const m = /\.innerHTML\s*=/.exec(line);
        if (m) return m;
      }
      return null;
    },
    message: "Assignment to innerHTML detected – XSS risk",
    suggestion: "Use safe DOM APIs like textContent or a sanitizer library",
  },
  {
    severity: "warning",
    rule: "sql-injection-risk",
    test: (_f, lines) => {
      for (const line of lines) {
        const m = /(?:execute|query|run)\s*\(\s*[`'"]/.exec(line);
        if (m) return m;
      }
      return null;
    },
    message: "Raw SQL string interpolation detected – SQL injection risk",
    suggestion: "Use parameterised queries or an ORM",
  },
  // ── Performance ─────────────────────────────────────────────────────────
  {
    severity: "info",
    rule: "large-dependency-import",
    test: (_f, lines) => {
      for (const line of lines) {
        const m = /import\s+.*\s+from\s+['"]lodash['"]/.exec(line);
        if (m) return m;
      }
      return null;
    },
    message: "Importing entire lodash – prefer tree-shakeable sub-imports",
    suggestion: "Use lodash/{functionName} subpath imports",
  },
  // ── TypeScript / JS quality ─────────────────────────────────────────────
  {
    severity: "warning",
    rule: "no-any",
    test: (_f, lines) => {
      for (const line of lines) {
        const m = /:\s*any\b/.exec(line);
        if (m) return m;
      }
      return null;
    },
    message: "Type `any` used – disables type checking",
    suggestion: "Replace `any` with a proper type or `unknown`",
  },
  {
    severity: "info",
    rule: "long-function",
    test: (file, _lines) => {
      const lineCount = file.diff.split("\n").length;
      // Heuristic: added/changed hunks > 100 lines may warrant refactoring
      if (lineCount > 100) return [""] as unknown as RegExpExecArray;
      return null;
    },
    message: "Large diff hunk – consider splitting into smaller functions",
    suggestion: "Refactor this change into smaller, focused functions",
  },
];

// ---------------------------------------------------------------------------
// CodeReviewAgent
// ---------------------------------------------------------------------------

export class CodeReviewAgent extends Agent<ReviewContext, ReviewOutput> {
  /**
   * Additional patterns supplied at construction time (merged with defaults).
   */
  private readonly extraPatterns: IssuePattern[] = [];

  constructor(config: Partial<AgentConfig> = {}) {
    super({ ...DEFAULT_CONFIG, ...config });
    this.extraPatterns = [];
  }

  /**
   * Register additional check patterns at runtime.
   */
  addPatterns(...pats: ReadonlyArray<IssuePattern>): this {
    this.extraPatterns.push(...pats);
    return this;
  }

  // ── Execute ──────────────────────────────────────────────────────────────

  protected override async execute(
    context: ReviewContext,
  ): Promise<ReviewOutput> {
    const allPatterns = [...patterns, ...this.extraPatterns];
    const comments: Array<ReviewComment> = [];

    for (const file of context.files) {
      const lines = file.diff.split("\n");

      for (const pattern of allPatterns) {
        const match = pattern.test(file, lines);
        if (match !== null) {
          comments.push(this.buildComment(file, pattern, lines, match));
        }
      }
    }

    // Deduplicate by (filePath, line, rule)
    const unique = this.deduplicate(comments);

    return {
      summary: `Reviewed ${context.files.length} file(s), found ${unique.length} issue(s)`,
      comments: unique,
      filesReviewed: context.files.length,
      issuesFound: unique.length,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private buildComment(
    file: FileChange,
    pattern: IssuePattern,
    lines: ReadonlyArray<string>,
    match: RegExpExecArray,
  ): ReviewComment {
    // Estimate line number from the first added line in the hunk
    const line = this.guessLine(lines, match);

    return {
      filePath: file.path,
      line,
      severity: pattern.severity,
      message: pattern.message,
      rule: pattern.rule,
      suggestion: pattern.suggestion,
    };
  }

  /**
   * Crude heuristic: find the first `+` line in the diff hunk and use its
   * position.  In a real agent this would parse unified-diff hunk headers.
   */
  private guessLine(lines: ReadonlyArray<string>, _match: RegExpExecArray): number {
    for (let i = 0; i < Math.min(lines.length, 50); i++) {
      const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(lines[i]!);
      if (header) {
        return Number(header[1]);
      }
    }
    return 1;
  }

  private deduplicate(
    comments: ReadonlyArray<ReviewComment>,
  ): ReadonlyArray<ReviewComment> {
    const seen = new Set<string>();
    const result: Array<ReviewComment> = [];

    for (const c of comments) {
      const key = `${c.filePath}:${c.line}:${c.rule ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(c);
      }
    }

    return result;
  }
}
