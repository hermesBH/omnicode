/**
 * IssueTriageAgent – analyzes new issues, suggests labels, assignees, and priority.
 *
 * The agent classifies incoming issues by type (bug, feature, enhancement, etc.)
 * using heuristic pattern matching on the title and body, then maps those
 * classifications to suggested labels, assignees, and priority levels.
 *
 * This is a reference implementation. Production agents would integrate
 * with ML classifiers, historical issue data, or team assignment rules.
 */

import { Agent, type AgentConfig } from "../Agent.ts";
import type {
  IssueType,
  Priority,
  TriageContext,
  TriageOutput,
} from "../types.ts";

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: AgentConfig = {
  type: "issue-triage",
  name: "Issue Triage Agent",
  description: "Classifies new issues by type, suggests labels, assignees, and priority",
  version: "0.1.0",
};

// ---------------------------------------------------------------------------
// Classification rules
// ---------------------------------------------------------------------------

/**
 * A single classification rule: a label, a set of trigger patterns, and
 * the resulting type/priority mapping.
 */
interface ClassificationRule {
  type: IssueType;
  patterns: ReadonlyArray<RegExp>;
  label: string;
  priority: Priority;
}

const rules: ReadonlyArray<ClassificationRule> = [
  {
    type: "bug",
    patterns: [
      /(?:^|\s)(bug|bug report|broken|crash|error|fails?|failing|incorrect|wrong|not working|regression|issue)(?:\s|$)/i,
      /(?:^|\s)(fix|hotfix|patch|defect)(?:\s|$)/i,
    ],
    label: "bug",
    priority: "high",
  },
  {
    type: "feature",
    patterns: [
      /(?:^|\s)(feature|feat|request|new|add|implement|proposal|suggestion)(?:\s|$)/i,
      /(?:^|\s)(would be nice|would like|i wish|idea)(?:\s|$)/i,
    ],
    label: "enhancement",
    priority: "medium",
  },
  {
    type: "enhancement",
    patterns: [
      /(?:^|\s)(improve|improvement|refine|better|optimize|upgrade|enhance)(?:\s|$)/i,
    ],
    label: "enhancement",
    priority: "medium",
  },
  {
    type: "documentation",
    patterns: [
      /(?:^|\s)(docs?|documentation|readme|typo|spelling|comment|doc)(?:\s|$)/i,
    ],
    label: "documentation",
    priority: "low",
  },
  {
    type: "question",
    patterns: [
      /(?:^|\s)(question|how|why|what|help|support|usage)(?:\s|$)/i,
      /\?$/,
    ],
    label: "question",
    priority: "low",
  },
  {
    type: "performance",
    patterns: [
      /(?:^|\s)(performance|slow|latency|memory|leak|bottleneck|perf)(?:\s|$)/i,
    ],
    label: "performance",
    priority: "medium",
  },
  {
    type: "security",
    patterns: [
      /(?:^|\s)(security|vulnerability|cve|exploit|xss|sqli|injection|auth)(?:\s|$)/i,
    ],
    label: "security",
    priority: "critical",
  },
  {
    type: "refactor",
    patterns: [
      /(?:^|\s)(refactor|cleanup|restructure|technical debt|tech debt|code quality)(?:\s|$)/i,
    ],
    label: "refactor",
    priority: "low",
  },
];

// ---------------------------------------------------------------------------
// IssueTriageAgent
// ---------------------------------------------------------------------------

export class IssueTriageAgent extends Agent<TriageContext, TriageOutput> {
  /**
   * Additional rules supplied at construction (merged with defaults).
   */
  private readonly extraRules: ReadonlyArray<ClassificationRule> = [];

  constructor(config: Partial<AgentConfig> = {}) {
    super({ ...DEFAULT_CONFIG, ...config });

    if (config.options?.rules && Array.isArray(config.options.rules)) {
      this.extraRules = config.options.rules as ReadonlyArray<ClassificationRule>;
    }
  }

  // ── Execute ──────────────────────────────────────────────────────────────

  protected override async execute(
    context: TriageContext,
  ): Promise<TriageOutput> {
    const text = `${context.title}\n${context.body}`;
    const allRules = [...rules, ...this.extraRules];

    // Score each rule by counting matched patterns
    const scores = new Map<ClassificationRule, number>();

    for (const rule of allRules) {
      let score = 0;
      for (const pattern of rule.patterns) {
        if (pattern.test(text)) {
          // Multiple matches on different patterns increase confidence
          score += 1;
        }
      }
      if (score > 0) {
        scores.set(rule, score);
      }
    }

    // Choose the best-matching rule (highest score, then first rule order)
    const best = [...scores.entries()].sort(
      ([, a], [, b]) => b - a,
    )[0];

    // Base output
    const output: TriageOutput = {
      issueType: best?.[0].type ?? "other",
      suggestedLabels: [],
      suggestedAssignees: [],
      priority: best?.[0].priority ?? "medium",
      confidence: best ? Math.min(best[1] / 3, 1.0) : 0.2,
      reasoning: best
        ? `Matched ${best[1]} pattern(s) for type "${best[0].type}"`
        : "No strong classification signals detected — defaulting to 'other'",
    };

    // Build output using a mutable record to satisfy ReadonlyArray fields
    const suggestedLabels: Array<string> = [...context.existingLabels];
    if (best) {
      suggestedLabels.push(best[0].label);
    }
    suggestedLabels.push(output.issueType);

    // Promote priority for security/bug issues with strong signal
    let priority: Priority = output.priority;
    if (
      (output.issueType === "security" || output.issueType === "bug") &&
      output.confidence >= 0.66
    ) {
      priority = output.issueType === "security" ? "critical" : "high";
    }

    const suggestedAssignees = this.suggestAssignees(context, output);

    return {
      ...output,
      priority,
      suggestedLabels: [...new Set(suggestedLabels)].sort(),
      suggestedAssignees,
    };
  }

  // ── Assignee suggestion ──────────────────────────────────────────────────

  /**
   * Simple assignee heuristic.  In production this would talk to a team
   * membership service or load-balancing algorithm.
   */
  private suggestAssignees(
    _context: TriageContext,
    output: TriageOutput,
  ): ReadonlyArray<string> {
    if (output.priority === "critical" || output.priority === "high") {
      // Critical/high items should be assigned to a senior maintainer
      return ["senior-maintainer"];
    }

    if (output.issueType === "documentation") {
      return ["docs-team"];
    }

    if (output.issueType === "question") {
      return ["support-team"];
    }

    return [];
  }
}
