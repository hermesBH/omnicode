import type {
  PluginHook,
  HookHandler,
  PluginHookContext,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookRegistration<H extends PluginHook = PluginHook> {
  readonly hook: H;
  readonly pluginId: string;
  readonly handler: HookHandler<H>;
  readonly priority: number;
}

/**
 * Event emitter for plugin lifecycle hooks.
 * Manages registration and invocation of hook handlers.
 */
export class HookEmitter {
  private registrations: Array<HookRegistration> = [];

  /**
   * Register a hook handler for a specific plugin.
   */
  register<H extends PluginHook>(
    pluginId: string,
    hook: H,
    handler: HookHandler<H>,
    priority = 0,
  ): void {
    this.registrations.push({
      hook,
      pluginId,
      handler: handler as HookHandler,
      priority,
    });
  }

  /**
   * Unregister a previously-registered hook handler.
   */
  unregister<H extends PluginHook>(
    pluginId: string,
    hook: H,
    handler: HookHandler<H>,
  ): void {
    const idx = this.registrations.findIndex(
      (r) =>
        r.hook === hook &&
        r.pluginId === pluginId &&
        r.handler === (handler as HookHandler),
    );
    if (idx >= 0) {
      this.registrations.splice(idx, 1);
    }
  }

  /**
   * Emit an event for a hook, invoking all registered handlers in priority order.
   * Higher priority handlers run first. Errors from individual handlers are caught
   * and logged but do not prevent other handlers from running.
   */
  async emit<H extends PluginHook>(
    hook: H,
    context: PluginHookContext[H],
  ): Promise<void> {
    const matched = this.registrations
      .filter((r) => r.hook === hook)
      .sort((a, b) => b.priority - a.priority);

    for (const reg of matched) {
      try {
        await Promise.resolve(reg.handler(context as never));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
          `[HookEmitter] Plugin "${reg.pluginId}" handler for "${hook}" failed:`,
          error,
        );
      }
    }
  }

  /**
   * Get all registrations for a specific hook.
   */
  getRegistrations<H extends PluginHook>(hook: H): ReadonlyArray<HookRegistration<H>> {
    return this.registrations.filter(
      (r) => r.hook === hook,
    ) as unknown as ReadonlyArray<HookRegistration<H>>;
  }

  /**
   * Remove all registrations belonging to a specific plugin.
   */
  clear(pluginId: string): void {
    this.registrations = this.registrations.filter(
      (r) => r.pluginId !== pluginId,
    );
  }

  /**
   * Remove all registrations.
   */
  clearAll(): void {
    this.registrations = [];
  }

  /**
   * Get the total number of registered handlers.
   */
  get size(): number {
    return this.registrations.length;
  }
}
