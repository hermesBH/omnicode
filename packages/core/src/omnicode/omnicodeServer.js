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
import { DefaultPluginRegistry, } from "@omnicode/plugin";
import { AgentRegistry, RegistryError, } from "@omnicode/ai";
import { GitHubClient, IssuesService, ReposService, makeGitHubClient, makeIssuesService, makeReposService, } from "@omnicode/github";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
export class OmniCodeServerConfig extends Context.Service()("@omnicode/server/OmniCodeServerConfig") {
}
export const OmniCodeServerConfigDefault = {
    enabled: false,
    pluginDirs: [],
};
export class OmniCodePluginRegistryService extends Context.Service()("@omnicode/server/PluginRegistry") {
}
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
export const OmniCodePluginRegistryLive = Layer.effect(OmniCodePluginRegistryService, Effect.sync(() => {
    const inner = new DefaultPluginRegistry();
    return {
        // register is synchronous and may throw (if plugin already registered)
        register: (plugin, manifest, dir) => Effect.sync(() => inner.register(plugin, manifest, dir)),
        // unregister is async
        unregister: (pluginId) => Effect.tryPromise(() => inner.unregister(pluginId)),
        // load is async (loads module, validates, activates)
        load: (disco) => Effect.tryPromise(() => inner.load(disco)),
        // loadAll is async (discovers and loads from directories)
        loadAll: (dirs) => Effect.tryPromise(() => inner.loadAll(dirs)),
        // activate is async
        activate: (pluginId) => Effect.tryPromise(() => inner.activate(pluginId)),
        // deactivate is async
        deactivate: (pluginId) => Effect.tryPromise(() => inner.deactivate(pluginId)),
        // get is synchronous
        get: (pluginId) => Effect.sync(() => inner.get(pluginId)),
        // list is synchronous
        list: () => Effect.sync(() => inner.list()),
        // getAgents is synchronous
        getAgents: () => Effect.sync(() => inner.getAgents()),
        // getRoutes is synchronous
        getRoutes: () => Effect.sync(() => inner.getRoutes()),
        // getProviders is synchronous
        getProviders: () => Effect.sync(() => inner.getProviders()),
        // getPaints is synchronous
        getPaints: () => Effect.sync(() => inner.getPaints()),
    };
}));
/**
 * Extended PluginRegistry layer that also runs plugin discovery during
 * construction, matching the pattern used in serverRuntimeStartup.ts
 * where services start background processes during initialization.
 *
 * Requires `OmniCodeServerConfig` to be provided upstream.
 */
export const OmniCodePluginRegistryWithDiscoveryLive = Layer.effect(OmniCodePluginRegistryService, Effect.gen(function* () {
    const config = yield* OmniCodeServerConfig;
    // Construct the inner registry directly (avoids circular dependency)
    const inner = new DefaultPluginRegistry();
    const registryShape = {
        register: (plugin, manifest, dir) => Effect.sync(() => inner.register(plugin, manifest, dir)),
        unregister: (pluginId) => Effect.tryPromise(() => inner.unregister(pluginId)),
        load: (disco) => Effect.tryPromise(() => inner.load(disco)),
        loadAll: (dirs) => Effect.tryPromise(() => inner.loadAll(dirs)),
        activate: (pluginId) => Effect.tryPromise(() => inner.activate(pluginId)),
        deactivate: (pluginId) => Effect.tryPromise(() => inner.deactivate(pluginId)),
        get: (pluginId) => Effect.sync(() => inner.get(pluginId)),
        list: () => Effect.sync(() => inner.list()),
        getAgents: () => Effect.sync(() => inner.getAgents()),
        getRoutes: () => Effect.sync(() => inner.getRoutes()),
        getProviders: () => Effect.sync(() => inner.getProviders()),
        getPaints: () => Effect.sync(() => inner.getPaints()),
    };
    if (config.enabled && config.pluginDirs && config.pluginDirs.length > 0) {
        yield* registryShape.loadAll(config.pluginDirs).pipe(Effect.flatMap((result) => Effect.logInfo("OmniCode plugin discovery complete", {
            loaded: result.loaded,
            errors: result.errors.length,
        })), Effect.catchAll((cause) => Effect.logWarning("OmniCode plugin discovery failed", { cause })), Effect.forkScoped);
    }
    return registryShape;
}));
export class OmniCodeAgentRegistryService extends Context.Service()("@omnicode/server/AgentRegistry") {
}
/**
 * Live layer for the AgentRegistry service.
 *
 * Creates a new `AgentRegistry` instance and wraps each method in
 * `Effect.sync` / `Effect.tryPromise` as appropriate.
 */
export const OmniCodeAgentRegistryLive = Layer.effect(OmniCodeAgentRegistryService, Effect.sync(() => {
    const inner = new AgentRegistry();
    return {
        // register is synchronous and may throw RegistryError
        register: (agent) => Effect.sync(() => {
            inner.register(agent);
        }),
        // registerOrReplace is synchronous
        registerOrReplace: (agent) => Effect.sync(() => {
            inner.registerOrReplace(agent);
        }),
        // unregister is synchronous
        unregister: (type) => Effect.sync(() => inner.unregister(type)),
        // get is synchronous
        get: (type) => Effect.sync(() => inner.get(type)),
        // require is synchronous, may throw RegistryError
        require: (type) => Effect.sync(() => inner.require(type)),
        // dispatch is async (agent.run() returns a Promise)
        dispatch: (type, input) => Effect.tryPromise({
            try: () => inner.dispatch(type, input),
            catch: (error) => error instanceof RegistryError
                ? error
                : new RegistryError(error instanceof Error ? error.message : String(error), "EXECUTION_FAILED"),
        }),
        // listTypes is synchronous
        listTypes: () => Effect.sync(() => inner.listTypes()),
        // listAgents is synchronous
        listAgents: () => Effect.sync(() => inner.listAgents()),
        // size is a getter turned into an Effect
        get size() {
            return Effect.sync(() => inner.size);
        },
        // clear is synchronous
        clear: () => Effect.sync(() => inner.clear()),
    };
}));
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
export const OmniCodeGitHubClientLive = Layer.effect(GitHubClient, Effect.map(OmniCodeServerConfig, (config) => {
    const ghConfig = {
        auth: { _tag: "token", token: config.githubToken ?? "" },
        ...(config.githubBaseUrl ? { baseUrl: config.githubBaseUrl } : {}),
    };
    return makeGitHubClient(ghConfig);
}));
// =============================================================================
// GitHub Service Layers — compose on top of GitHubClient
// =============================================================================
/**
 * IssuesService layer using the package's built-in `makeIssuesService` Effect
 * (which already depends on GitHubClient from context).
 */
export const OmniCodeIssuesServiceLive = Layer.effect(IssuesService, makeIssuesService);
/**
 * ReposService layer using the package's built-in `makeReposService` Effect
 * (which already depends on GitHubClient from context).
 */
export const OmniCodeReposServiceLive = Layer.effect(ReposService, makeReposService);
/**
 * Combined GitHub service layer (Issues + Repos), fully wired to GitHubClient.
 */
export const OmniCodeGitHubServicesLive = Layer.mergeAll(OmniCodeIssuesServiceLive, OmniCodeReposServiceLive);
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
export const OmniCodeServicesLive = Layer.mergeAll(OmniCodePluginRegistryLive, OmniCodeAgentRegistryLive, OmniCodeGitHubClientLive);
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
export const makeOmniCodeServerLayer = (config) => {
    const mergedConfig = {
        ...OmniCodeServerConfigDefault,
        ...config,
    };
    return OmniCodeServicesLive.pipe(Layer.provide(Layer.sync(OmniCodeServerConfig, () => mergedConfig)));
};
