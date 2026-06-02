import type {
  OmniCodePlugin,
  PluginManifest,
  PluginState,
  PluginContext,
  HookHandler,
  PluginHook,
  PluginHookContext,
  AgentContribution,
  RouteContribution,
  ProviderContribution,
  PaintContribution,
} from "./types.ts";
import { HookEmitter } from "./hooks.ts";
import {
  type DiscoPlugin,
  discoverPlugins as discoPlugins,
  loadPluginModule,
  validatePluginModule,
} from "./loader.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoadedPlugin {
  readonly dir: string;
  readonly manifest: PluginManifest;
  readonly instance: OmniCodePlugin;
  readonly state: PluginState;
}

export interface RegistryEntry {
  readonly disco: DiscoPlugin;
  readonly instance: OmniCodePlugin;
  state: PluginState;
  error?: string;
}

export interface PluginRegistry {
  /** Register a plugin instance directly (for testing / built-in plugins). */
  readonly register: (
    plugin: OmniCodePlugin,
    manifest: PluginManifest,
    dir?: string,
  ) => void;

  /** Unregister & deactivate a plugin by id. */
  readonly unregister: (pluginId: string) => Promise<void>;

  /** Load a plugin from a discovery descriptor, activate it. */
  readonly load: (disco: DiscoPlugin) => Promise<void>;

  /** Discover and load all plugins from a set of directories. */
  readonly loadAll: (dirs: ReadonlyArray<string>) => Promise<{
    readonly loaded: number;
    readonly errors: ReadonlyArray<string>;
  }>;

  /** Activate a registered plugin. */
  readonly activate: (pluginId: string) => Promise<void>;

  /** Deactivate a registered plugin. */
  readonly deactivate: (pluginId: string) => Promise<void>;

  /** Get a loaded plugin by id. */
  readonly get: (pluginId: string) => LoadedPlugin | undefined;

  /** List all registered plugins. */
  readonly list: () => ReadonlyArray<LoadedPlugin>;

  /** Get all contributed agents across all active plugins. */
  readonly getAgents: () => ReadonlyArray<AgentContribution>;

  /** Get all contributed routes across all active plugins. */
  readonly getRoutes: () => ReadonlyArray<RouteContribution>;

  /** Get all contributed providers across all active plugins. */
  readonly getProviders: () => ReadonlyArray<ProviderContribution>;

  /** Get all contributed paints across all active plugins. */
  readonly getPaints: () => ReadonlyArray<PaintContribution>;
}

// ---------------------------------------------------------------------------
// Internal: Plugin Context Implementation
// ---------------------------------------------------------------------------

const createPluginContext = (
  manifest: PluginManifest,
  hookEmitter: HookEmitter,
): PluginContext => ({
  manifest,

  onHook<H extends PluginHook>(hook: H, handler: HookHandler<H>): void {
    hookEmitter.register(manifest.id, hook, handler);
  },

  offHook<H extends PluginHook>(hook: H, handler: HookHandler<H>): void {
    hookEmitter.unregister(manifest.id, hook, handler);
  },

  async emit<H extends PluginHook>(hook: H, context: PluginHookContext[H]): Promise<void> {
    await hookEmitter.emit(hook, context);
  },

  log(level, message, data): void {
    const prefix = `[${manifest.name}] ${message}`;
    switch (level) {
      case "error":
        process.stderr.write(`ERROR ${prefix} ${data ? JSON.stringify(data) : ""}\n`);
        break;
      case "warn":
        process.stderr.write(`WARN ${prefix} ${data ? JSON.stringify(data) : ""}\n`);
        break;
      case "debug":
        process.stderr.write(`DEBUG ${prefix} ${data ? JSON.stringify(data) : ""}\n`);
        break;
      default:
        process.stdout.write(`INFO ${prefix} ${data ? JSON.stringify(data) : ""}\n`);
        break;
    }
  },
});

// ---------------------------------------------------------------------------
// Default Registry Implementation
// ---------------------------------------------------------------------------

export class DefaultPluginRegistry implements PluginRegistry {
  private entries = new Map<string, RegistryEntry>();
  private hookEmitter = new HookEmitter();

  /**
   * Register a plugin instance directly (for testing / built-in plugins).
   * Throws if already registered.
   */
  register(
    plugin: OmniCodePlugin,
    manifest: PluginManifest,
    _dir = "",
  ): void {
    const pluginId = manifest.id;
    if (this.entries.has(pluginId)) {
      throw new Error(`Plugin "${pluginId}" is already registered`);
    }

    this.entries.set(pluginId, {
      disco: { dir: _dir, manifest, entryPoint: "" },
      instance: plugin,
      state: "inactive",
    });
  }

  /**
   * Unregister & deactivate a plugin by id.
   */
  async unregister(pluginId: string): Promise<void> {
    await this.deactivate(pluginId).catch(() => {});
    this.hookEmitter.clear(pluginId);
    this.entries.delete(pluginId);
  }

  /**
   * Load a plugin from a discovery descriptor and activate it.
   * If already registered, skip with a warning.
   */
  async load(disco: DiscoPlugin): Promise<void> {
    const pluginId = disco.manifest.id;

    if (this.entries.has(pluginId)) {
      process.stderr.write(`Plugin "${pluginId}" already loaded, skipping\n`);
      return;
    }

    const mod = await loadPluginModule(disco.entryPoint);
    const validated = validatePluginModule(mod, pluginId);

    const plugin = mod as OmniCodePlugin;

    this.entries.set(pluginId, {
      disco,
      instance: plugin,
      state: "inactive",
    });

    await this.activate(pluginId);
  }

  /**
   * Discover and load all plugins from a set of directories.
   * Errors are accumulated and returned.
   */
  async loadAll(dirs: ReadonlyArray<string>): Promise<{
    readonly loaded: number;
    readonly errors: ReadonlyArray<string>;
  }> {
    const result = await discoPlugins(dirs);
    const errors: Array<string> = [];

    for (const err of result.errors) {
      errors.push(`[${err.dir}] ${err.error}`);
    }

    let loaded = 0;
    for (const plugin of result.plugins) {
      try {
        await this.load(plugin);
        loaded++;
      } catch (error) {
        errors.push(`[${plugin.manifest.id}] ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { loaded, errors };
  }

  /**
   * Activate a registered plugin.
   */
  async activate(pluginId: string): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }
    if (entry.state === "active" || entry.state === "activating") return;

    entry.state = "activating";

    const ctx = createPluginContext(entry.disco.manifest, this.hookEmitter);

    try {
      await Promise.resolve(entry.instance.activate(ctx));
      entry.state = "active";
      process.stderr.write(`Plugin "${pluginId}" activated\n`);
    } catch (error) {
      entry.state = "error";
      entry.error = String(error);
      process.stderr.write(`Plugin "${pluginId}" activation failed: ${error}\n`);
    }
  }

  /**
   * Deactivate a registered plugin.
   */
  async deactivate(pluginId: string): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry || entry.state === "inactive") return;

    entry.state = "deactivating";

    if (entry.instance.deactivate) {
      try {
        await Promise.resolve(entry.instance.deactivate());
      } catch (error) {
        process.stderr.write(`Plugin "${pluginId}" deactivation error: ${error}\n`);
      }
    }

    this.hookEmitter.clear(pluginId);
    entry.state = "inactive";
  }

  /**
   * Get a loaded plugin by id.
   */
  get(pluginId: string): LoadedPlugin | undefined {
    const entry = this.entries.get(pluginId);
    if (!entry) return undefined;

    return {
      dir: entry.disco.dir,
      manifest: entry.disco.manifest,
      instance: entry.instance,
      state: entry.state,
    };
  }

  /**
   * List all registered plugins.
   */
  list(): ReadonlyArray<LoadedPlugin> {
    return Array.from(this.entries.values()).map((entry) => ({
      dir: entry.disco.dir,
      manifest: entry.disco.manifest,
      instance: entry.instance,
      state: entry.state,
    }));
  }

  /**
   * Get all contributed agents across all active plugins.
   */
  getAgents(): ReadonlyArray<AgentContribution> {
    return this.collectContributions<AgentContribution>(
      (m) => m.contributes?.agents as AgentContribution[] | undefined,
    );
  }

  /**
   * Get all contributed routes across all active plugins.
   */
  getRoutes(): ReadonlyArray<RouteContribution> {
    return this.collectContributions<RouteContribution>(
      (m) => m.contributes?.routes as RouteContribution[] | undefined,
    );
  }

  /**
   * Get all contributed providers across all active plugins.
   */
  getProviders(): ReadonlyArray<ProviderContribution> {
    return this.collectContributions<ProviderContribution>(
      (m) => m.contributes?.providers as ProviderContribution[] | undefined,
    );
  }

  /**
   * Get all contributed paints across all active plugins.
   */
  getPaints(): ReadonlyArray<PaintContribution> {
    return this.collectContributions<PaintContribution>(
      (m) => m.contributes?.paints as PaintContribution[] | undefined,
    );
  }

  /**
   * Internal helper to collect contributions from all active plugins.
   */
  private collectContributions<T>(
    extract: (manifest: PluginManifest) => ReadonlyArray<T> | undefined,
  ): ReadonlyArray<T> {
    const results: Array<T> = [];
    for (const entry of this.entries.values()) {
      if (entry.state !== "active") continue;
      const items = extract(entry.disco.manifest);
      if (items) {
        results.push(...items);
      }
    }
    return results;
  }
}

// ---------------------------------------------------------------------------
// Singleton registry
// ---------------------------------------------------------------------------

let defaultRegistry: DefaultPluginRegistry | null = null;

/**
 * Get or create the default plugin registry.
 */
export const getDefaultRegistry = (): DefaultPluginRegistry => {
  if (!defaultRegistry) {
    defaultRegistry = new DefaultPluginRegistry();
  }
  return defaultRegistry;
};

// ---------------------------------------------------------------------------
// Convenience accessors (operate on default registry)
// ---------------------------------------------------------------------------

export const registerPlugin = (
  plugin: OmniCodePlugin,
  manifest: PluginManifest,
  dir?: string,
): void =>
  getDefaultRegistry().register(plugin, manifest, dir);

export const loadPlugin = (disco: DiscoPlugin): Promise<void> =>
  getDefaultRegistry().load(disco);

export const loadAllPlugins = (
  dirs: ReadonlyArray<string>,
): Promise<{ readonly loaded: number; readonly errors: ReadonlyArray<string> }> =>
  getDefaultRegistry().loadAll(dirs);

export const getPlugin = (pluginId: string): LoadedPlugin | undefined =>
  getDefaultRegistry().get(pluginId);

export const listPlugins = (): ReadonlyArray<LoadedPlugin> =>
  getDefaultRegistry().list();

export const activatePlugin = (pluginId: string): Promise<void> =>
  getDefaultRegistry().activate(pluginId);

export const deactivatePlugin = (pluginId: string): Promise<void> =>
  getDefaultRegistry().deactivate(pluginId);

export const unregisterPlugin = (pluginId: string): Promise<void> =>
  getDefaultRegistry().unregister(pluginId);

export const getPluginAgents = (): ReadonlyArray<AgentContribution> =>
  getDefaultRegistry().getAgents();

export const getPluginRoutes = (): ReadonlyArray<RouteContribution> =>
  getDefaultRegistry().getRoutes();

export const getPluginProviders = (): ReadonlyArray<ProviderContribution> =>
  getDefaultRegistry().getProviders();

export const getPluginPaints = (): ReadonlyArray<PaintContribution> =>
  getDefaultRegistry().getPaints();
