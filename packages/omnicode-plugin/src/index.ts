// ---------------------------------------------------------------------------
// @omnicode/plugin — OmniCode Plugin API
//
// This package defines the extension/plugin system for OmniCode.
// Third-party extensions implement the OmniCodePlugin interface and are
// discovered, loaded, and managed via the PluginRegistry.
// ---------------------------------------------------------------------------

export * from "./types.ts";
export * from "./hooks.ts";
export * from "./loader.ts";
export * from "./registry.ts";
