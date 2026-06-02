import * as Schema from "effect/Schema";
// ---------------------------------------------------------------------------
// AI Provider Config
// ---------------------------------------------------------------------------
/**
 * Supported AI provider backends.
 */
export const AiProviderKind = Schema.Literals(["openai", "anthropic", "google", "azure", "ollama", "custom"]);
/**
 * Configuration for a single AI provider.
 */
export const AiProviderConfig = Schema.Struct({
    kind: AiProviderKind,
    apiKey: Schema.optional(Schema.String),
    baseUrl: Schema.optional(Schema.String),
    model: Schema.optional(Schema.String),
    maxTokens: Schema.optional(Schema.Number),
    temperature: Schema.optional(Schema.Number),
    organizationId: Schema.optional(Schema.String),
    projectId: Schema.optional(Schema.String),
});
// ---------------------------------------------------------------------------
// OmniCode Config
// ---------------------------------------------------------------------------
/**
 * Top-level configuration for OmniCode.
 */
export const OmnicodeConfig = Schema.Struct({
    /** Octokit authentication token for GitHub API access. */
    githubToken: Schema.optional(Schema.String),
    /** Base URL for GitHub API (for GHES self-hosted instances). */
    githubBaseUrl: Schema.optional(Schema.String),
    /** AI provider configuration. */
    aiProvider: Schema.optional(AiProviderConfig),
    /** Directories to scan for OmniCode plugins. */
    pluginDirs: Schema.optional(Schema.Array(Schema.String)),
    /** Enable or disable the OmniCode integration. */
    enabled: Schema.optional(Schema.Boolean),
    /** Log level for OmniCode services. */
    logLevel: Schema.optional(Schema.Literals(["debug", "info", "warn", "error"])),
});
/**
 * Default OmniCode configuration values.
 */
export const defaultOmnicodeConfig = {
    enabled: false,
    logLevel: "info",
    pluginDirs: [],
};
