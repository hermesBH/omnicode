import * as Schema from "effect/Schema";
import type { PluginManifest as PluginManifestType } from "./types.ts";
import { PluginManifest } from "./types.ts";

// ---------------------------------------------------------------------------
// Discovery Result
// ---------------------------------------------------------------------------

export interface DiscoPlugin {
  /** Absolute path to the plugin directory. */
  readonly dir: string;
  /** Parsed and validated manifest. */
  readonly manifest: PluginManifestType;
  /** Path to the main entry module (resolved relative to dir). */
  readonly entryPoint: string;
}

export interface DiscoveryError {
  readonly dir: string;
  readonly error: string;
}

export interface DiscoveryResult {
  readonly plugins: ReadonlyArray<DiscoPlugin>;
  readonly errors: ReadonlyArray<DiscoveryError>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MANIFEST_FILE = "package.json";
const KNOWN_PLUGIN_FIELDS = ["omnicode", "omnicode-plugin", "plugin"] as const;

/**
 * Check whether a given package.json blob looks like it belongs to an
 * OmniCode plugin (has the right marker field).
 */
const hasPluginMarker = (pkg: Record<string, unknown>): boolean =>
  KNOWN_PLUGIN_FIELDS.some((key) => key in pkg);

/**
 * Build a PluginManifest from a raw package.json after extracting the
 * plugin-specific section.
 */
const buildManifest = (
  dir: string,
  pkg: Record<string, unknown>,
): PluginManifestType => {
  // Determine where the plugin meta lives: look for the first known key
  const meta: Record<string, unknown> =
    KNOWN_PLUGIN_FIELDS.reduce<Record<string, unknown> | null>(
      (acc, key) => (acc ?? (key in pkg ? (pkg[key] as Record<string, unknown>) : null)),
      null,
    ) ?? pkg;

  const manifestInput = {
    id: meta.id ?? pkg.name,
    name: meta.name ?? pkg.name,
    version: meta.version ?? pkg.version ?? "0.0.0",
    description: meta.description ?? pkg.description,
    author: meta.author ?? pkg.author,
    license: meta.license ?? pkg.license,
    main: meta.main ?? pkg.main ?? "index.js",
    activationHooks: meta.activationHooks,
    contributes: meta.contributes,
  };

  return Schema.decodeUnknownSync(PluginManifest)(manifestInput);
};

// ---------------------------------------------------------------------------
// Loader Functions
// ---------------------------------------------------------------------------

/**
 * Read and parse a `package.json` from a directory, returning the raw content.
 * Throws on failure.
 */
const readPackageJson = async (dir: string): Promise<Record<string, unknown>> => {
  const mod = await import(/* @vite-ignore */ `${dir}/${MANIFEST_FILE}`);
  return mod.default ?? mod;
};

/**
 * Attempt to load a single plugin from a candidate directory.
 * Returns the plugin descriptor or throws an error.
 */
const loadPluginFromDir = async (dir: string): Promise<DiscoPlugin> => {
  const pkg = await readPackageJson(dir);

  if (!hasPluginMarker(pkg)) {
    throw new Error("No plugin marker found in package.json");
  }

  const manifest = buildManifest(dir, pkg);
  const entryPoint = `${dir}/${manifest.main}`;

  return { dir, manifest, entryPoint };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover all OmniCode plugins within a list of directories.
 * Walks each directory, looks for `package.json` files with a plugin marker,
 * parses the manifest, and returns validated plugin descriptors.
 *
 * Errors are accumulated and returned alongside successfully loaded plugins.
 */
export const discoverPlugins = async (
  dirs: ReadonlyArray<string>,
): Promise<DiscoveryResult> => {
  const results = await Promise.allSettled(
    dirs.map(async (dir) => {
      const plugin = await loadPluginFromDir(dir);
      return { dir, plugin };
    }),
  );

  const plugins: Array<DiscoPlugin> = [];
  const errors: Array<DiscoveryError> = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      plugins.push(result.value.plugin);
    } else {
      errors.push({
        dir: "unknown",
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  return { plugins, errors };
};

/**
 * Discover plugins from a single directory.
 */
export const discoverPluginsFromDir = async (dir: string): Promise<DiscoveryResult> =>
  discoverPlugins([dir]);

/**
 * Load a plugin's main module and return its default export (the OmniCodePlugin).
 */
export const loadPluginModule = async <T = unknown>(
  entryPoint: string,
): Promise<T> => {
  const mod = await import(/* @vite-ignore */ entryPoint);
  return (mod.default ?? mod) as T;
};

/**
 * Validate that a loaded plugin module conforms to the OmniCodePlugin interface.
 * Returns the module cast to the expected shape or throws a descriptive error.
 */
export const validatePluginModule = (
  mod: unknown,
  id: string,
): { id: string; activate: Function } => {
  const obj = mod as Record<string, unknown>;
  if (!obj || typeof obj !== "object") {
    throw new Error(`Plugin "${id}" main export is not an object`);
  }
  const resolvedId = typeof obj.id === "string" ? obj.id : id;
  if (typeof obj.activate !== "function") {
    throw new Error(
      `Plugin "${resolvedId}" does not export an "activate" function`,
    );
  }
  return {
    id: resolvedId,
    activate: obj.activate as Function,
  };
};
