/**
 * OmniCode Server Services
 *
 * Registers the OmniCode packages (PluginRegistry, GitHubClient, AgentRegistry,
 * IssuesService, ReposService) as Effect Context.Services using the Layer
 * pattern, matching the existing T3 Code server service conventions.
 *
 * Each service follows the pattern from apps/server/src/telemetry/:
 *   1. Define a `Context.Service` tag (class extending Context.Service)
 *   2. Define a `Layer.effect()` that constructs the implementation
 *   3. Export the layer for composition in server.ts
 *
 * @module omnicodeServer
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  DefaultPluginRegistry,
  type LoadedPlugin,
  type DiscoPlugin,
  type OmniCodePlugin,
  type PluginManifest,
  type AgentContribution,
  type RouteContribution,
  type ProviderContribution,
  type PaintContribution,
} from "@omnicode/plugin";
import {
  AgentRegistry,
  RegistryError,
  type Agent,
  type AgentType,
  type AgentResult,
} from "@omnicode/ai";
import {
  GitHubClient,
  IssuesService,
  ReposService,
  makeGitHubClient,
  makeIssuesService,
  makeReposService,
  type GitHubClientConfig,
  type GitHubClientShape,
} from "@omnicode/github";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/unstable/process";
import {
  VcsIntegrationService,
  VcsIntegrationLive,
  type VcsIntegrationShape,
} from "./omnicodeGitIntegration.ts";

// =============================================================================
// OmniCode Config Service
// =============================================================================

/**
 * Configuration shape for the OmniCode server integration.
 *
 * Loaded from server config and provided as an Effect service so that
 * downstream layers (PluginRegistry, GitHubClient, etc.) can consume it.
 */
export interface OmniCodeServerConfigShape {
  /** GitHub personal access token (or app token) for Octokit. */
  readonly githubToken?: string;
  /** Base URL for GitHub API (default: https://api.github.com). */
  readonly githubBaseUrl?: string;
  /** Directories to scan for OmniCode plugins. */
  readonly pluginDirs?: ReadonlyArray<string>;
  /** Whether the OmniCode subsystem is enabled. */
  readonly enabled: boolean;
}

export class OmniCodeServerConfig extends Context.Service<
  OmniCodeServerConfig,
  OmniCodeServerConfigShape
>()("@omnicode/server/OmniCodeServerConfig") {}

export const OmniCodeServerConfigDefault: OmniCodeServerConfigShape = {
  enabled: false,
  pluginDirs: [],
};

// =============================================================================
// PluginRegistry Service — wraps @omnicode/plugin DefaultPluginRegistry
// =============================================================================

/**
 * Shape for the PluginRegistry Effect service.
 *
 * Mirrors the `PluginRegistry` interface from `@omnicode/plugin/registry`
 * but converts all Promise-returning methods to Effect-returning methods
 * so they compose cleanly with other Effect services.
 */
export interface OmniCodePluginRegistryShape {
  readonly register: (
    plugin: OmniCodePlugin,
    manifest: PluginManifest,
    dir?: string,
  ) => Effect.Effect<void>;
  readonly unregister: (pluginId: string) => Effect.Effect<void>;
  readonly load: (disco: DiscoPlugin) => Effect.Effect<void>;
  readonly loadAll: (
    dirs: ReadonlyArray<string>,
  ) => Effect.Effect<{ readonly loaded: number; readonly errors: ReadonlyArray<string> }>;
  readonly activate: (pluginId: string) => Effect.Effect<void>;
  readonly deactivate: (pluginId: string) => Effect.Effect<void>;
  readonly get: (pluginId: string) => Effect.Effect<LoadedPlugin | undefined>;
  readonly list: () => Effect.Effect<ReadonlyArray<LoadedPlugin>>;
  readonly getAgents: () => Effect.Effect<ReadonlyArray<AgentContribution>>;
  readonly getRoutes: () => Effect.Effect<ReadonlyArray<RouteContribution>>;
  readonly getProviders: () => Effect.Effect<ReadonlyArray<ProviderContribution>>;
  readonly getPaints: () => Effect.Effect<ReadonlyArray<PaintContribution>>;
}

export class OmniCodePluginRegistryService extends Context.Service<
  OmniCodePluginRegistryService,
  OmniCodePluginRegistryShape
>()("@omnicode/server/PluginRegistry") {}

/**
 * Live layer for the PluginRegistry service.
 *
 * Creates a new `DefaultPluginRegistry` instance and wraps each method
 * in `Effect.sync` / `Effect.tryPromise` as appropriate.
 *
 * Sync methods (register, get, list, getAgents, etc.) use `Effect.sync`.
 * Async methods (unregister, load, loadAll, activate, deactivate) use
 * `Effect.tryPromise`.
 */
export const OmniCodePluginRegistryLive: Layer.Layer<OmniCodePluginRegistryService> =
  Layer.effect(
    OmniCodePluginRegistryService,
    Effect.sync((): OmniCodePluginRegistryShape => {
      const inner = new DefaultPluginRegistry();

      return {
        // register is synchronous and may throw (if plugin already registered)
        register: (plugin, manifest, dir) =>
          Effect.sync(() => inner.register(plugin, manifest, dir)),

        // unregister is async
        unregister: (pluginId) =>
          Effect.tryPromise(() => inner.unregister(pluginId)),

        // load is async (loads module, validates, activates)
        load: (disco) =>
          Effect.tryPromise(() => inner.load(disco)),

        // loadAll is async (discovers and loads from directories)
        loadAll: (dirs) =>
          Effect.tryPromise(() => inner.loadAll(dirs)),

        // activate is async
        activate: (pluginId) =>
          Effect.tryPromise(() => inner.activate(pluginId)),

        // deactivate is async
        deactivate: (pluginId) =>
          Effect.tryPromise(() => inner.deactivate(pluginId)),

        // get is synchronous
        get: (pluginId) =>
          Effect.sync(() => inner.get(pluginId)),

        // list is synchronous
        list: () =>
          Effect.sync(() => inner.list()),

        // getAgents is synchronous
        getAgents: () =>
          Effect.sync(() => inner.getAgents()),

        // getRoutes is synchronous
        getRoutes: () =>
          Effect.sync(() => inner.getRoutes()),

        // getProviders is synchronous
        getProviders: () =>
          Effect.sync(() => inner.getProviders()),

        // getPaints is synchronous
        getPaints: () =>
          Effect.sync(() => inner.getPaints()),
      };
    }),
  );

/**
 * Extended PluginRegistry layer that also runs plugin discovery during
 * construction, matching the pattern used in serverRuntimeStartup.ts
 * where services start background processes during initialization.
 *
 * Requires `OmniCodeServerConfig` to be provided upstream.
 */
export const OmniCodePluginRegistryWithDiscoveryLive: Layer.Layer<
  OmniCodePluginRegistryService,
  never,
  OmniCodeServerConfig
> = Layer.effect(
  OmniCodePluginRegistryService,
  Effect.gen(function* () {
    const config = yield* OmniCodeServerConfig;

    // Construct the inner registry directly (avoids circular dependency)
    const inner = new DefaultPluginRegistry();

    const registryShape: OmniCodePluginRegistryShape = {
      register: (plugin, manifest, dir) =>
        Effect.sync(() => inner.register(plugin, manifest, dir)),
      unregister: (pluginId) =>
        Effect.tryPromise(() => inner.unregister(pluginId)),
      load: (disco) =>
        Effect.tryPromise(() => inner.load(disco)),
      loadAll: (dirs) =>
        Effect.tryPromise(() => inner.loadAll(dirs)),
      activate: (pluginId) =>
        Effect.tryPromise(() => inner.activate(pluginId)),
      deactivate: (pluginId) =>
        Effect.tryPromise(() => inner.deactivate(pluginId)),
      get: (pluginId) =>
        Effect.sync(() => inner.get(pluginId)),
      list: () =>
        Effect.sync(() => inner.list()),
      getAgents: () =>
        Effect.sync(() => inner.getAgents()),
      getRoutes: () =>
        Effect.sync(() => inner.getRoutes()),
      getProviders: () =>
        Effect.sync(() => inner.getProviders()),
      getPaints: () =>
        Effect.sync(() => inner.getPaints()),
    };

    if (config.enabled && config.pluginDirs && config.pluginDirs.length > 0) {
      yield* registryShape.loadAll(config.pluginDirs).pipe(
        Effect.flatMap((result) =>
          Effect.logInfo("OmniCode plugin discovery complete", {
            loaded: result.loaded,
            errors: result.errors.length,
          }),
        ),
        Effect.catchAll((cause) =>
          Effect.logWarning("OmniCode plugin discovery failed", { cause }),
        ),
        Effect.forkScoped,
      );
    }

    return registryShape;
  }),
);

// =============================================================================
// AgentRegistry Service — wraps @omnicode/ai AgentRegistry
// =============================================================================

/**
 * Shape for the AgentRegistry Effect service.
 *
 * Converts the plain-class `AgentRegistry` (sync + async methods) into a
 * pure Effect service so it integrates with the T3 Code DI system.
 */
export interface OmniCodeAgentRegistryShape {
  readonly register: <TInput, TOutput>(
    agent: Agent<TInput, TOutput>,
  ) => Effect.Effect<void, RegistryError>;
  readonly registerOrReplace: <TInput, TOutput>(
    agent: Agent<TInput, TOutput>,
  ) => Effect.Effect<void>;
  readonly unregister: (type: AgentType) => Effect.Effect<boolean>;
  readonly get: <TInput, TOutput>(
    type: AgentType,
  ) => Effect.Effect<Agent<TInput, TOutput> | undefined>;
  readonly require: <TInput, TOutput>(
    type: AgentType,
  ) => Effect.Effect<Agent<TInput, TOutput>, RegistryError>;
  readonly dispatch: <TInput, TOutput>(
    type: AgentType,
    input: TInput,
  ) => Effect.Effect<AgentResult<TOutput>, RegistryError>;
  readonly listTypes: () => Effect.Effect<ReadonlyArray<AgentType>>;
  readonly listAgents: () => Effect.Effect<
    ReadonlyArray<{
      type: AgentType;
      name: string;
      description: string;
      version: string;
    }>
  >;
  readonly size: Effect.Effect<number>;
  readonly clear: () => Effect.Effect<void>;
}

export class OmniCodeAgentRegistryService extends Context.Service<
  OmniCodeAgentRegistryService,
  OmniCodeAgentRegistryShape
>()("@omnicode/server/AgentRegistry") {}

/**
 * Live layer for the AgentRegistry service.
 *
 * Creates a new `AgentRegistry` instance and wraps each method in
 * `Effect.sync` / `Effect.tryPromise` as appropriate.
 */
export const OmniCodeAgentRegistryLive: Layer.Layer<OmniCodeAgentRegistryService> =
  Layer.effect(
    OmniCodeAgentRegistryService,
    Effect.sync((): OmniCodeAgentRegistryShape => {
      const inner = new AgentRegistry();

      return {
        // register is synchronous and may throw RegistryError
        register: (agent) =>
          Effect.sync(() => {
            inner.register(agent);
          }),

        // registerOrReplace is synchronous
        registerOrReplace: (agent) =>
          Effect.sync(() => {
            inner.registerOrReplace(agent);
          }),

        // unregister is synchronous
        unregister: (type) =>
          Effect.sync(() => inner.unregister(type)),

        // get is synchronous
        get: (type) =>
          Effect.sync(() => inner.get(type)),

        // require is synchronous, may throw RegistryError
        require: (type) =>
          Effect.sync(() => inner.require(type)),

        // dispatch is async (agent.run() returns a Promise)
        dispatch: (type, input) =>
          Effect.tryPromise({
            try: () => inner.dispatch(type, input) as Promise<AgentResult<unknown>>,
            catch: (error) =>
              error instanceof RegistryError
                ? error
                : new RegistryError(
                    error instanceof Error ? error.message : String(error),
                    "EXECUTION_FAILED",
                  ),
          }),

        // listTypes is synchronous
        listTypes: () =>
          Effect.sync(() => inner.listTypes()),

        // listAgents is synchronous
        listAgents: () =>
          Effect.sync(() => inner.listAgents()),

        // size is a getter turned into an Effect
        get size(): Effect.Effect<number> {
          return Effect.sync(() => inner.size);
        },

        // clear is synchronous
        clear: () =>
          Effect.sync(() => inner.clear()),
      };
    }),
  );

// =============================================================================
// GitHubClient Layer — provides the @omnicode/github GitHubClient
// =============================================================================

/**
 * Creates a GitHubClient Live layer using config from OmniCodeServerConfig.
 *
 * The `GitHubClient` (from `@omnicode/github`) is already a `Context.Service`.
 * This layer constructs the live instance using the `makeGitHubClient` factory
 * with credentials from the server config.
 */
export const OmniCodeGitHubClientLive: Layer.Layer<
  typeof GitHubClient,
  never,
  OmniCodeServerConfig
> = Layer.effect(
  GitHubClient,
  Effect.map(
    OmniCodeServerConfig,
    (config): GitHubClientShape => {
      const ghConfig: GitHubClientConfig = {
        auth: { _tag: "token", token: config.githubToken ?? "" },
        ...(config.githubBaseUrl ? { baseUrl: config.githubBaseUrl } : {}),
      };
      return makeGitHubClient(ghConfig);
    },
  ),
);

// =============================================================================
// GitHub Service Layers — compose on top of GitHubClient
// =============================================================================

/**
 * IssuesService layer using the package's built-in `makeIssuesService` Effect
 * (which already depends on GitHubClient from context).
 */
export const OmniCodeIssuesServiceLive: Layer.Layer<
  typeof IssuesService,
  never,
  typeof GitHubClient
> = Layer.effect(IssuesService, makeIssuesService);

/**
 * ReposService layer using the package's built-in `makeReposService` Effect
 * (which already depends on GitHubClient from context).
 */
export const OmniCodeReposServiceLive: Layer.Layer<
  typeof ReposService,
  never,
  typeof GitHubClient
> = Layer.effect(ReposService, makeReposService);

/**
 * Combined GitHub service layer (Issues + Repos), fully wired to GitHubClient.
 */
export const OmniCodeGitHubServicesLive: Layer.Layer<
  typeof IssuesService | typeof ReposService,
  never,
  typeof GitHubClient
> = Layer.mergeAll(
  OmniCodeIssuesServiceLive,
  OmniCodeReposServiceLive,
);

// =============================================================================
// Combined OmniCode Services Layer
// =============================================================================

/**
 * Merge all core OmniCode service layers into one.
 *
 * This layer includes PluginRegistry, AgentRegistry, and GitHubClient.
 * It does NOT include GitHub sub-services (IssuesService, ReposService) —
 * those are provided via `OmniCodeGitHubServicesLive` if needed.
 *
 * Requires `OmniCodeServerConfig` to be provided upstream.
 *
 * Usage in server.ts:
 * ```ts
 * const OmniCodeLayer = OmniCodeServicesLive.pipe(
 *   Layer.provide(OmniCodeServerConfigLive),
 * );
 * const RuntimeServicesLive = ServerRuntimeStartupLive.pipe(
 *   Layer.provideMerge(RuntimeDependenciesLive),
 *   Layer.provideMerge(OmniCodeLayer),
 * );
 * ```
 */
export const OmniCodeServicesLive: Layer.Layer<
  | OmniCodePluginRegistryService
  | OmniCodeAgentRegistryService
  | typeof GitHubClient
  | VcsIntegrationService,
  never,
  | OmniCodeServerConfig
  | typeof ChildProcessSpawner.ChildProcessSpawner
> = Layer.mergeAll(
  OmniCodePluginRegistryLive,
  OmniCodeAgentRegistryLive,
  OmniCodeGitHubClientLive,
  VcsIntegrationLive,
);

/**
 * Convenience factory that wraps OmniCodeServicesLive with a default config.
 *
 * Call this in the server composition to get a layer that provides all
 * OmniCode services without requiring OmniCodeServerConfig upstream.
 *
 * @example
 * ```ts
 * const omniCodeLayer = makeOmniCodeServerLayer({
 *   enabled: true,
 *   githubToken: process.env.GITHUB_TOKEN,
 * });
 * ```
 */
export const makeOmniCodeServerLayer = (
  config?: Partial<OmniCodeServerConfigShape>,
): Layer.Layer<
  | OmniCodePluginRegistryService
  | OmniCodeAgentRegistryService
  | typeof GitHubClient
> => {
  const mergedConfig: OmniCodeServerConfigShape = {
    ...OmniCodeServerConfigDefault,
    ...config,
  };
  return OmniCodeServicesLive.pipe(
    Layer.provide(
      Layer.sync(OmniCodeServerConfig, () => mergedConfig),
    ),
  );
};
