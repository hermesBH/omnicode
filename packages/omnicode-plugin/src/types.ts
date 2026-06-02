import * as Schema from "effect/Schema";

// ---------------------------------------------------------------------------
// Branded Identifiers
// ---------------------------------------------------------------------------

const makeEntityId = <Brand extends string>(brand: Brand) =>
  Schema.String.pipe(Schema.brand(brand));

export const PluginId = makeEntityId("PluginId");
export type PluginId = typeof PluginId.Type;

export const PluginVersion = makeEntityId("PluginVersion");
export type PluginVersion = typeof PluginVersion.Type;

// ---------------------------------------------------------------------------
// Plugin Hook Types
// ---------------------------------------------------------------------------

/**
 * All supported lifecycle hooks that plugins can register against.
 */
export const PluginHook = Schema.Literals([
  "pr:created",
  "pr:reviewed",
  "issue:created",
  "issue:assigned",
  "agent:before_run",
  "agent:after_run",
]);
export type PluginHook = typeof PluginHook.Type;

/**
 * Context passed to a "pr:created" hook handler.
 */
export const PrCreatedContext = Schema.Struct({
  pullRequestId: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  author: Schema.String,
  repository: Schema.String,
  branch: Schema.String,
  baseBranch: Schema.String,
  url: Schema.optional(Schema.String),
  createdAt: Schema.String,
});
export type PrCreatedContext = typeof PrCreatedContext.Type;

/**
 * Context passed to a "pr:reviewed" hook handler.
 */
export const PrReviewedContext = Schema.Struct({
  pullRequestId: Schema.String,
  reviewer: Schema.String,
  reviewBody: Schema.optional(Schema.String),
  approved: Schema.Boolean,
  url: Schema.optional(Schema.String),
  reviewedAt: Schema.String,
});
export type PrReviewedContext = typeof PrReviewedContext.Type;

/**
 * Context passed to an "issue:created" hook handler.
 */
export const IssueCreatedContext = Schema.Struct({
  issueId: Schema.String,
  title: Schema.String,
  description: Schema.optional(Schema.String),
  author: Schema.String,
  repository: Schema.String,
  labels: Schema.optional(Schema.Array(Schema.String)),
  url: Schema.optional(Schema.String),
  createdAt: Schema.String,
});
export type IssueCreatedContext = typeof IssueCreatedContext.Type;

/**
 * Context passed to an "issue:assigned" hook handler.
 */
export const IssueAssignedContext = Schema.Struct({
  issueId: Schema.String,
  title: Schema.String,
  assignee: Schema.String,
  previousAssignee: Schema.optional(Schema.String),
  repository: Schema.String,
  url: Schema.optional(Schema.String),
  assignedAt: Schema.String,
});
export type IssueAssignedContext = typeof IssueAssignedContext.Type;

/**
 * Context passed to an "agent:before_run" hook handler.
 */
export const AgentBeforeRunContext = Schema.Struct({
  agentId: Schema.String,
  task: Schema.String,
  model: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  cwd: Schema.optional(Schema.String),
});
export type AgentBeforeRunContext = typeof AgentBeforeRunContext.Type;

/**
 * Context passed to an "agent:after_run" hook handler.
 */
export const AgentAfterRunContext = Schema.Struct({
  agentId: Schema.String,
  task: Schema.String,
  result: Schema.optional(Schema.String),
  durationMs: Schema.Number,
  success: Schema.Boolean,
  error: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
});
export type AgentAfterRunContext = typeof AgentAfterRunContext.Type;

/**
 * Union of all hook context types, keyed by hook name.
 */
export type PluginHookContext = {
  "pr:created": PrCreatedContext;
  "pr:reviewed": PrReviewedContext;
  "issue:created": IssueCreatedContext;
  "issue:assigned": IssueAssignedContext;
  "agent:before_run": AgentBeforeRunContext;
  "agent:after_run": AgentAfterRunContext;
};

/**
 * Handler function type for a specific hook.
 */
export type HookHandler<H extends PluginHook = PluginHook> =
  (context: PluginHookContext[H]) => void | Promise<void>;

// ---------------------------------------------------------------------------
// Contribution Types
// ---------------------------------------------------------------------------

/**
 * An agent contributed by a plugin.
 */
export const AgentContribution = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  version: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  capabilities: Schema.optional(Schema.Array(Schema.String)),
});
export type AgentContribution = typeof AgentContribution.Type;

/**
 * A UI route/panel contributed by a plugin.
 */
export const RouteContribution = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  icon: Schema.optional(Schema.String),
  path: Schema.String,
  component: Schema.String,
  panel: Schema.optional(Schema.String),
  navigation: Schema.Literals(["sidebar", "top", "settings", "dropdown"]),
});
export type RouteContribution = typeof RouteContribution.Type;

/**
 * A source control provider contributed by a plugin.
 */
export const ProviderContribution = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  type: Schema.Literals(["github", "gitlab", "bitbucket", "gitea", "custom"]),
  baseUrl: Schema.String,
  apiVersion: Schema.optional(Schema.String),
  authType: Schema.Literals(["token", "oauth", "basic", "none"]),
  capabilities: Schema.optional(Schema.Array(Schema.String)),
});
export type ProviderContribution = typeof ProviderContribution.Type;

/**
 * A paint (UI decoration) contribution by a plugin.
 */
export const PaintContribution = Schema.Struct({
  id: Schema.String,
  target: Schema.String,
  style: Schema.optional(Schema.String),
  position: Schema.Literals(["before", "after", "replace", "append", "prepend"]),
  component: Schema.String,
});
export type PaintContribution = typeof PaintContribution.Type;

// ---------------------------------------------------------------------------
// Plugin Manifest
// ---------------------------------------------------------------------------

/**
 * Schema for a plugin manifest (package.json-style descriptor).
 */
export const PluginManifest = Schema.Struct({
  id: PluginId,
  name: Schema.String,
  version: Schema.String,
  description: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  license: Schema.optional(Schema.String),
  main: Schema.String,
  activationHooks: Schema.optional(Schema.Array(PluginHook)),
  contributes: Schema.optional(
    Schema.Struct({
      agents: Schema.optional(Schema.Array(AgentContribution)),
      routes: Schema.optional(Schema.Array(RouteContribution)),
      providers: Schema.optional(Schema.Array(ProviderContribution)),
      paints: Schema.optional(Schema.Array(PaintContribution)),
    }),
  ),
});
export type PluginManifest = typeof PluginManifest.Type;

// ---------------------------------------------------------------------------
// Plugin Context
// ---------------------------------------------------------------------------

/**
 * Services exposed to a plugin during activation.
 */
export interface PluginContext {
  /** The plugin's own manifest. */
  readonly manifest: PluginManifest;

  /** Register a hook handler. */
  onHook<H extends PluginHook>(hook: H, handler: HookHandler<H>): void;

  /** Unregister a previously-registered hook handler. */
  offHook<H extends PluginHook>(hook: H, handler: HookHandler<H>): void;

  /** Emit an event for a hook, invoking all registered handlers. */
  emit<H extends PluginHook>(hook: H, context: PluginHookContext[H]): Promise<void>;

  /** Log a message (delegates to host logger). */
  log(level: "debug" | "info" | "warn" | "error", message: string, data?: unknown): void;
}

// ---------------------------------------------------------------------------
// Plugin Interface
// ---------------------------------------------------------------------------

/**
 * The interface every OmniCode plugin must export as its default or `.activate` export.
 */
export interface OmniCodePlugin {
  /** Short identifier for the plugin (matches PluginManifest.id). */
  readonly id: string;

  /** Called when the plugin is loaded and activated by the host. */
  activate(context: PluginContext): void | Promise<void>;

  /** Called when the plugin is being deactivated / unloaded. */
  deactivate?(): void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Plugin State
// ---------------------------------------------------------------------------

/**
 * Runtime state of a loaded plugin.
 */
export const PluginState = Schema.Literals(["inactive", "activating", "active", "deactivating", "error"]);
export type PluginState = typeof PluginState.Type;
