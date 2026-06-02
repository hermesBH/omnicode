/**
 * AgentRegistry – holds agents and dispatches to the correct one by type.
 *
 * Agents are registered by their `type` string and looked up dynamically
 * so that callers (webhook handlers, CLI commands, etc.) never need to
 * import specific agent classes directly.
 */

import type { AgentType, AgentResult } from "./types.ts";
import { Agent } from "./Agent.ts";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RegistryError extends Error {
  readonly code: "DUPLICATE" | "NOT_FOUND" | "EXECUTION_FAILED";

  constructor(
    message: string,
    code: "DUPLICATE" | "NOT_FOUND" | "EXECUTION_FAILED",
  ) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class AgentRegistry {
  /** Registered agents keyed by type. */
  private readonly agents = new Map<AgentType, Agent<unknown, unknown>>();

  // ── Registration ────────────────────────────────────────────────────────

  /**
   * Register an agent with the registry.
   *
   * @throws {RegistryError} if an agent with the same type is already
   *   registered (use `registerOrReplace` to override).
   */
  register<TInput, TOutput>(agent: Agent<TInput, TOutput>): this {
    if (this.agents.has(agent.type)) {
      throw new RegistryError(
        `Agent "${agent.type}" is already registered`,
        "DUPLICATE",
      );
    }
    this.agents.set(agent.type, agent as Agent<unknown, unknown>);
    return this;
  }

  /**
   * Register or replace an agent by type.
   */
  registerOrReplace<TInput, TOutput>(agent: Agent<TInput, TOutput>): this {
    this.agents.set(agent.type, agent as Agent<unknown, unknown>);
    return this;
  }

  /**
   * Remove a previously registered agent.
   *
   * @returns `true` if the agent existed and was removed.
   */
  unregister(type: AgentType): boolean {
    return this.agents.delete(type);
  }

  // ── Lookup ──────────────────────────────────────────────────────────────

  /**
   * Retrieve a registered agent by type.
   */
  get<TInput = unknown, TOutput = unknown>(
    type: AgentType,
  ): Agent<TInput, TOutput> | undefined {
    return this.agents.get(type) as Agent<TInput, TOutput> | undefined;
  }

  /**
   * Assert that an agent is registered and throw if not.
   */
  require<TInput = unknown, TOutput = unknown>(
    type: AgentType,
  ): Agent<TInput, TOutput> {
    const agent = this.get<TInput, TOutput>(type);
    if (!agent) {
      throw new RegistryError(
        `Agent "${type}" is not registered`,
        "NOT_FOUND",
      );
    }
    return agent;
  }

  // ── Dispatch ────────────────────────────────────────────────────────────

  /**
   * Look up an agent by type and run it.
   *
   * This is the primary dispatch mechanism — webhook handlers and other
   * callers use this instead of calling `agent.run()` directly.
   *
   * @returns The agent's result.
   */
  async dispatch<TInput, TOutput>(
    type: AgentType,
    input: TInput,
  ): Promise<AgentResult<TOutput>> {
    const agent = this.require<unknown, TOutput>(type);
    try {
      return await agent.run(input as unknown) as AgentResult<TOutput>;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      throw new RegistryError(
        `Agent "${type}" execution failed: ${message}`,
        "EXECUTION_FAILED",
      );
    }
  }

  // ── Introspection ───────────────────────────────────────────────────────

  /**
   * List all registered agent types.
   */
  listTypes(): ReadonlyArray<AgentType> {
    return [...this.agents.keys()];
  }

  /**
   * List all registered agents with their descriptors.
   */
  listAgents(): ReadonlyArray<{ type: AgentType; name: string; description: string; version: string }> {
    return [...this.agents.values()].map((a) => a.describe());
  }

  /**
   * Number of registered agents.
   */
  get size(): number {
    return this.agents.size;
  }

  /**
   * Remove all agents from the registry.
   */
  clear(): void {
    this.agents.clear();
  }
}
