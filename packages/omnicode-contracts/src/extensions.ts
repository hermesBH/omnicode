import * as Schema from "effect/Schema";

// ---------------------------------------------------------------------------
// Extension Point
// ---------------------------------------------------------------------------

/**
 * Where a plugin can extend the UI.
 */
export const NavigationTarget = Schema.Literals(["sidebar", "top", "settings", "dropdown"]);
export type NavigationTarget = typeof NavigationTarget.Type;

/**
 * A UI extension point contributed by a plugin.
 */
export const ExtensionPoint = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  icon: Schema.optional(Schema.String),
  path: Schema.String,
  navigation: NavigationTarget,
  panel: Schema.optional(Schema.String),
  component: Schema.String,
});
export type ExtensionPoint = typeof ExtensionPoint.Type;

// ---------------------------------------------------------------------------
// Extension Schema
// ---------------------------------------------------------------------------

/**
 * Provider type contributed by a plugin.
 */
export const ProviderType = Schema.Literals(["github", "gitlab", "bitbucket", "gitea", "custom"]);
export type ProviderType = typeof ProviderType.Type;

/**
 * Auth method used by a provider.
 */
export const AuthMethod = Schema.Literals(["token", "oauth", "basic", "none"]);
export type AuthMethod = typeof AuthMethod.Type;

/**
 * A provider contribution from a plugin.
 */
export const ProviderContribution = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  type: ProviderType,
  baseUrl: Schema.String,
  apiVersion: Schema.optional(Schema.String),
  authType: AuthMethod,
  capabilities: Schema.optional(Schema.Array(Schema.String)),
});
export type ProviderContribution = typeof ProviderContribution.Type;

/**
 * A paint (UI decoration) contributed by a plugin.
 */
export const PaintPosition = Schema.Literals(["before", "after", "replace", "append", "prepend"]);
export type PaintPosition = typeof PaintPosition.Type;

/**
 * A UI paint contribution from a plugin.
 */
export const PaintContribution = Schema.Struct({
  id: Schema.String,
  target: Schema.String,
  style: Schema.optional(Schema.String),
  position: PaintPosition,
  component: Schema.String,
});
export type PaintContribution = typeof PaintContribution.Type;

/**
 * Full extension schema describing what a plugin contributes.
 */
export const ExtensionSchema = Schema.Struct({
  extensionPointId: Schema.String,
  pluginId: Schema.String,
  version: Schema.String,
  routes: Schema.optional(Schema.Array(ExtensionPoint)),
  providers: Schema.optional(Schema.Array(ProviderContribution)),
  paints: Schema.optional(Schema.Array(PaintContribution)),
  agents: Schema.optional(Schema.Array(Schema.String)),
  hooks: Schema.optional(Schema.Array(Schema.String)),
});
export type ExtensionSchema = typeof ExtensionSchema.Type;
