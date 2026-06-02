/**
 * Abstract base Agent class.
 *
 * Provides the standard lifecycle: initialize → run → complete → cleanup.
 * All agents in the @omnicode/ai framework extend this class and implement
 * the abstract `execute()` method.
 */

import type {
  AgentDescriptor,
  AgentLifecycle,
  AgentResult,
  AgentType,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AgentConfig {
  readonly type: AgentType;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  /** Arbitrary per-agent options (merged with defaults at construction). */
  readonly options?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export abstract class Agent<TInput = unknown, TOutput = unknown> {
  // ── Descriptor ──────────────────────────────────────────────────────────
  readonly type: AgentType;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly options: Readonly<Record<string, unknown>>;

  // ── Lifecycle state ─────────────────────────────────────────────────────
  protected lifecycle: AgentLifecycle = "idle";
  protected startTime = 0;

  constructor(config: AgentConfig) {
    this.type = config.type;
    this.name = config.name;
    this.description = config.description;
    this.version = config.version;
    this.options = Object.freeze({ ...(config.options ?? {}) });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /** Return the agent's descriptor (metadata). */
  describe(): AgentDescriptor {
    return {
      type: this.type,
      name: this.name,
      description: this.description,
      version: this.version,
    };
  }

  /** Current lifecycle phase. */
  get status(): AgentLifecycle {
    return this.lifecycle;
  }

  /**
   * Run the agent end-to-end: initialize, execute, complete, cleanup.
   *
   * @returns An `AgentResult` wrapping the output or error.
   */
  async run(input: TInput): Promise<AgentResult<TOutput>> {
    this.startTime = performance.now();

    try {
      this.lifecycle = "initializing";
      await this.initialize(input);

      this.lifecycle = "running";
      const output = await this.execute(input);

      this.lifecycle = "completed";
      await this.complete(output);

      return this.result(output, true);
    } catch (error) {
      this.lifecycle = "failed";

      const message =
        error instanceof Error ? error.message : String(error);

      return this.result(undefined as unknown as TOutput, false, message);
    } finally {
      this.lifecycle = "cleanedUp";
      await this.cleanup();
    }
  }

  // ── Lifecycle hooks (override in subclasses) ────────────────────────────

  /**
   * Prepare the agent for execution (load models, validate config, etc.).
   * Called once before `execute()`.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async initialize(_input: TInput): Promise<void> {
    // default: no-op
  }

  /**
   * Core logic – every agent must implement this.
   */
  protected abstract execute(input: TInput): Promise<TOutput>;

  /**
   * Called after a successful execution (logging, notifications, etc.).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async complete(_output: TOutput): Promise<void> {
    // default: no-op
  }

  /**
   * Tear down resources (close connections, free memory).
   * Always called, even when execution fails.
   */
  protected async cleanup(): Promise<void> {
    // default: no-op
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private result(
    output: TOutput,
    success: boolean,
    error?: string,
  ): AgentResult<TOutput> {
    return {
      agent: this.type,
      success,
      output,
      durationMs: Math.round(performance.now() - this.startTime),
      ...(error !== undefined ? { error } : {}),
    };
  }
}
