/**
 * OmniCode REST Router
 *
 * Implements REST endpoints for the OmniCode integration using Effect's
 * `HttpRouter.add()` pattern — exactly the same pattern used throughout
 * `apps/server/src/http.ts` and `apps/server/src/auth/http.ts`.
 *
 * Endpoints:
 *   GET    /api/omnicode/status         – Health & status
 *   GET    /api/omnicode/plugins         – List registered plugins
 *   GET    /api/omnicode/agents          – List registered agents
 *   POST   /api/omnicode/agents/execute  – Execute an agent
 *   GET    /api/omnicode/repos/search    – Search GitHub repos
 *   GET    /api/omnicode/issues          – List GitHub issues
 *
 * Each endpoint uses Effect.Schema from `@omnicode/contracts` for
 * request/response validation where applicable.
 *
 * Dependencies:
 *   - OmniCodePluginRegistryService (from omnicodeServer.ts)
 *   - OmniCodeAgentRegistryService  (from omnicodeServer.ts)
 *   - ReposService / IssuesService   (from @omnicode/github)
 *
 * @module omnicodeRouter
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  AgentExecutionRequest,
  type AgentExecutionRequest as AgentExecutionRequestType,
} from "@omnicode/contracts";
import {
  ReposService,
  type ReposServiceShape,
  IssuesService,
  type IssuesServiceShape,
} from "@omnicode/github";
import {
  OmniCodePluginRegistryService,
  type OmniCodePluginRegistryShape,
  OmniCodeAgentRegistryService,
  type OmniCodeAgentRegistryShape,
} from "./omnicodeServer.ts";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  HttpRouter,
  HttpServerResponse,
  HttpServerRequest,
} from "effect/unstable/http";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract query parameters from the request URL as a flat string map.
 *
 * Returns `{}` when the URL cannot be parsed (e.g. missing URL).
 */
const getQueryParams = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const url = HttpServerRequest.toURL(request);
  if (Option.isNone(url)) {
    return {} as Record<string, string>;
  }
  const params: Record<string, string> = {};
  url.value.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
});

/**
 * Parse JSON body from the request, returning `undefined` on parse failure.
 */
const getJsonBody = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const body = yield* request.json.pipe(
    Effect.catchAll(() => Effect.succeed(undefined)),
  );
  return body as unknown;
});

// =============================================================================
// GET /api/omnicode/status
// =============================================================================

/**
 * Health/status endpoint.
 *
 * Returns basic info about the OmniCode subsystem including the number of
 * registered plugins and agents.
 *
 * Response (200):
 * ```json
 * { "status": "ok", "service": "omnicode", "version": "0.0.1",
 *   "pluginsLoaded": 0, "agentsRegistered": 0 }
 * ```
 */
const statusHandler = Effect.gen(function* () {
  const pluginRegistry: OmniCodePluginRegistryShape = yield* OmniCodePluginRegistryService;
  const agentRegistry: OmniCodeAgentRegistryShape = yield* OmniCodeAgentRegistryService;
  const plugins = yield* pluginRegistry.list();
  const agents = yield* agentRegistry.listAgents();

  return HttpServerResponse.jsonUnsafe(
    {
      status: "ok",
      service: "omnicode",
      version: "0.0.1",
      pluginsLoaded: plugins.length,
      agentsRegistered: agents.length,
    },
    { status: 200 },
  );
}).pipe(
  Effect.catchAll((error) =>
    Effect.succeed(
      HttpServerResponse.text(`Status check failed: ${error}`, { status: 500 }),
    ),
  ),
);

export const omnicodeStatusRouteLayer: Layer.Layer<
  never,
  never,
  OmniCodePluginRegistryService | OmniCodeAgentRegistryService
> = HttpRouter.add("GET", "/api/omnicode/status", statusHandler);

// =============================================================================
// GET /api/omnicode/plugins
// =============================================================================

/**
 * List all registered plugins with their basic metadata and state.
 *
 * Response (200): Array of plugin descriptors.
 */
const pluginsHandler = Effect.gen(function* () {
  const pluginRegistry: OmniCodePluginRegistryShape = yield* OmniCodePluginRegistryService;
  const plugins = yield* pluginRegistry.list();

  return HttpServerResponse.jsonUnsafe(
    plugins.map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      description: p.manifest.description ?? null,
      state: p.state,
      ...(p.manifest.contributes
        ? {
            agents: p.manifest.contributes.agents?.length ?? 0,
            routes: p.manifest.contributes.routes?.length ?? 0,
            providers: p.manifest.contributes.providers?.length ?? 0,
            paints: p.manifest.contributes.paints?.length ?? 0,
          }
        : {}),
    })),
    { status: 200 },
  );
}).pipe(
  Effect.catchAll((error) =>
    Effect.succeed(
      HttpServerResponse.text(`Failed to list plugins: ${error}`, { status: 500 }),
    ),
  ),
);

export const omnicodePluginsRouteLayer: Layer.Layer<
  never,
  never,
  OmniCodePluginRegistryService
> = HttpRouter.add("GET", "/api/omnicode/plugins", pluginsHandler);

// =============================================================================
// GET /api/omnicode/agents
// =============================================================================

/**
 * List all registered agents with their descriptors.
 *
 * Response (200): Array of agent info objects.
 */
const agentsHandler = Effect.gen(function* () {
  const agentRegistry: OmniCodeAgentRegistryShape = yield* OmniCodeAgentRegistryService;
  const agents = yield* agentRegistry.listAgents();

  return HttpServerResponse.jsonUnsafe(
    agents.map((a) => ({
      id: a.type,
      name: a.name,
      description: a.description,
      version: a.version,
      capabilities: [],
      enabled: true,
    })),
    { status: 200 },
  );
}).pipe(
  Effect.catchAll((error) =>
    Effect.succeed(
      HttpServerResponse.text(`Failed to list agents: ${error}`, { status: 500 }),
    ),
  ),
);

export const omnicodeAgentsRouteLayer: Layer.Layer<
  never,
  never,
  OmniCodeAgentRegistryService
> = HttpRouter.add("GET", "/api/omnicode/agents", agentsHandler);

// =============================================================================
// POST /api/omnicode/agents/execute
// =============================================================================

/**
 * Execute an agent by kind with the provided task and context.
 *
 * Request body is validated against `AgentExecutionRequest` schema.
 *
 * Request:
 * ```json
 * { "agentKind": "code-review", "task": "Review this PR",
 *   "context": { ... } }
 * ```
 *
 * Response (200):
 * ```json
 * { "agentKind": "code-review", "success": true,
 *   "status": "completed", "output": { ... },
 *   "durationMs": 1234, ... }
 * ```
 */
const agentsExecuteHandler = Effect.gen(function* () {
  const agentRegistry: OmniCodeAgentRegistryShape = yield* OmniCodeAgentRegistryService;
  const body = yield* getJsonBody;

  // Validate request body against AgentExecutionRequest schema
  const validationResult = yield* Effect.either(
    Schema.decodeUnknown(AgentExecutionRequest)(body),
  );

  if (Either.isLeft(validationResult)) {
    return HttpServerResponse.text(
      `Invalid request body: ${validationResult.left.message}`,
      { status: 400 },
    );
  }

  const request: AgentExecutionRequestType = validationResult.right;
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  // Dispatch to the agent registry
  const dispatchResult = yield* Effect.either(
    agentRegistry.dispatch(request.agentKind, {
      task: request.task,
      ...(request.context ? { context: request.context } : {}),
    }),
  );

  const durationMs = Date.now() - startMs;
  const completedAt = new Date().toISOString();

  if (Either.isLeft(dispatchResult)) {
    const error =
      dispatchResult.left instanceof Error
        ? dispatchResult.left.message
        : String(dispatchResult.left);

    return HttpServerResponse.jsonUnsafe(
      {
        agentKind: request.agentKind,
        success: false,
        status: "failed",
        error,
        durationMs,
        startedAt,
        completedAt,
      },
      { status: 200 },
    );
  }

  return HttpServerResponse.jsonUnsafe(
    {
      agentKind: request.agentKind,
      success: true,
      status: "completed",
      output: dispatchResult.right.output ?? null,
      durationMs,
      startedAt,
      completedAt,
    },
    { status: 200 },
  );
}).pipe(
  Effect.catchAll((error) =>
    Effect.succeed(
      HttpServerResponse.text(`Agent execution failed: ${error}`, { status: 500 }),
    ),
  ),
);

export const omnicodeAgentsExecuteRouteLayer: Layer.Layer<
  never,
  never,
  OmniCodeAgentRegistryService
> = HttpRouter.add("POST", "/api/omnicode/agents/execute", agentsExecuteHandler);

// =============================================================================
// GET /api/omnicode/repos/search
// =============================================================================

/**
 * Search GitHub repositories.
 *
 * Query parameters:
 *   - query (required): Search query string
 *   - sort (optional): stars | forks | updated | help-wanted-issues
 *   - order (optional): asc | desc
 *   - perPage (optional): Number of results per page
 *   - page (optional): Page number
 *
 * Response (200): `RepoSearchResult` shape { items, totalCount, incompleteResults }
 *
 * Requires ReposService (which depends on GitHubClient from omnicodeServer).
 */
const reposSearchHandler = Effect.gen(function* () {
  const reposService: ReposServiceShape = yield* ReposService;
  const params = yield* getQueryParams;

  const query = params["query"];
  if (!query || query.trim().length === 0) {
    return HttpServerResponse.text("Missing required query parameter: query", {
      status: 400,
    });
  }

  const result = yield* reposService.searchRepos({
    query,
    sort: params["sort"] as "stars" | "forks" | "updated" | "help-wanted-issues" | undefined,
    order: params["order"] as "asc" | "desc" | undefined,
    perPage: params["perPage"] ? Number(params["perPage"]) : undefined,
    page: params["page"] ? Number(params["page"]) : undefined,
  });

  return HttpServerResponse.jsonUnsafe(
    {
      items: result.items,
      totalCount: result.totalCount,
      incompleteResults: result.incompleteResults,
    },
    { status: 200 },
  );
}).pipe(
  Effect.catchAll((error) =>
    Effect.succeed(
      HttpServerResponse.text(`Repository search failed: ${error}`, { status: 500 }),
    ),
  ),
);

export const omnicodeReposSearchRouteLayer: Layer.Layer<
  never,
  never,
  typeof ReposService
> = HttpRouter.add("GET", "/api/omnicode/repos/search", reposSearchHandler);

// =============================================================================
// GET /api/omnicode/issues
// =============================================================================

/**
 * List GitHub issues for a repository.
 *
 * Query parameters:
 *   - owner (required): Repository owner
 *   - repo (required): Repository name
 *   - state (optional): open | closed | all
 *   - labels (optional): Comma-separated list of labels
 *   - sort (optional): created | updated | comments
 *   - direction (optional): asc | desc
 *   - since (optional): ISO 8601 date string
 *   - perPage (optional): Number of results per page
 *   - page (optional): Page number
 *   - milestone (optional): Milestone number or string
 *   - assignee (optional): Username
 *   - creator (optional): Username
 *
 * Response (200): Array of `GitHubIssue`-shaped objects.
 *
 * Requires IssuesService (which depends on GitHubClient from omnicodeServer).
 */
const issuesHandler = Effect.gen(function* () {
  const issuesService: IssuesServiceShape = yield* IssuesService;
  const params = yield* getQueryParams;

  const owner = params["owner"];
  const repo = params["repo"];

  if (!owner || !repo) {
    return HttpServerResponse.text(
      "Missing required query parameters: owner, repo",
      { status: 400 },
    );
  }

  const labels = params["labels"]
    ? params["labels"].split(",").map((l) => l.trim()).filter(Boolean)
    : undefined;

  const result = yield* issuesService.listIssues({
    owner,
    repo,
    state: params["state"] as "open" | "closed" | "all" | undefined,
    labels,
    sort: params["sort"] as "created" | "updated" | "comments" | undefined,
    direction: params["direction"] as "asc" | "desc" | undefined,
    since: params["since"],
    perPage: params["perPage"] ? Number(params["perPage"]) : undefined,
    page: params["page"] ? Number(params["page"]) : undefined,
    milestone: params["milestone"]
      ? isNaN(Number(params["milestone"]))
        ? params["milestone"]
        : Number(params["milestone"])
      : undefined,
    assignee: params["assignee"],
    creator: params["creator"],
  });

  return HttpServerResponse.jsonUnsafe(result, { status: 200 });
}).pipe(
  Effect.catchAll((error) =>
    Effect.succeed(
      HttpServerResponse.text(`Failed to list issues: ${error}`, { status: 500 }),
    ),
  ),
);

export const omnicodeIssuesRouteLayer: Layer.Layer<
  never,
  never,
  typeof IssuesService
> = HttpRouter.add("GET", "/api/omnicode/issues", issuesHandler);

// =============================================================================
// Combined OmniCode Routes Layer
// =============================================================================

/**
 * Merge all OmniCode route layers into one.
 *
 * Wire this into server.ts's `makeRoutesLayer`:
 *
 * ```ts
 * import { omnicodeRoutesLayer } from "@t3tools/core/omnicode-router";
 *
 * const makeRoutesLayer = Layer.mergeAll(
 *   ...existingRoutes,
 *   omnicodeRoutesLayer,
 * ).pipe(Layer.provide(browserApiCorsLayer));
 * ```
 *
 * Requires the following services upstream (provided by omnicodeServer.ts):
 *   - OmniCodePluginRegistryService
 *   - OmniCodeAgentRegistryService
 *   - ReposService
 *   - IssuesService
 */
export const omnicodeRoutesLayer: Layer.Layer<
  never,
  never,
  | OmniCodePluginRegistryService
  | OmniCodeAgentRegistryService
  | typeof ReposService
  | typeof IssuesService
> = Layer.mergeAll(
  omnicodeStatusRouteLayer,
  omnicodePluginsRouteLayer,
  omnicodeAgentsRouteLayer,
  omnicodeAgentsExecuteRouteLayer,
  omnicodeReposSearchRouteLayer,
  omnicodeIssuesRouteLayer,
);
