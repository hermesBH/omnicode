import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Predicate from "effect/Predicate";

import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class GitHubAuthError extends Data.TaggedError("GitHubAuthError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class GitHubApiError extends Data.TaggedError("GitHubApiError")<{
  readonly operation: string;
  readonly status: number;
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class GitHubNotFoundError extends Data.TaggedError("GitHubNotFoundError")<{
  readonly resource: string;
  readonly message: string;
}> {}

export class GitHubRateLimitError extends Data.TaggedError("GitHubRateLimitError")<{
  readonly retryAfter: number;
  readonly message: string;
}> {}

export type GitHubError =
  | GitHubAuthError
  | GitHubApiError
  | GitHubNotFoundError
  | GitHubRateLimitError;

// ---------------------------------------------------------------------------
// Auth configuration
// ---------------------------------------------------------------------------

export interface GitHubTokenAuth {
  readonly _tag: "token";
  readonly token: string;
}

export interface GitHubAppAuth {
  readonly _tag: "app";
  readonly appId: string;
  readonly privateKey: string;
  readonly installationId?: string;
}

export interface GitHubOAuthAuth {
  readonly _tag: "oauth";
  readonly clientId: string;
  readonly clientSecret: string;
  readonly code: string;
}

export type GitHubAuthConfig =
  | GitHubTokenAuth
  | GitHubAppAuth
  | GitHubOAuthAuth;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface GitHubClientConfig {
  readonly auth: GitHubTokenAuth;
  readonly baseUrl?: string;
  readonly userAgent?: string;
  readonly logRequests?: boolean;
}

// ---------------------------------------------------------------------------
// Service shape
// ---------------------------------------------------------------------------

export interface GitHubClientShape {
  /** The underlying Octokit instance. Used internally by services. */
  readonly octokit: Octokit;

  /** Execute a request with proper error wrapping. */
  readonly request: <T>(
    operation: string,
    request: Promise<T>,
  ) => Effect.Effect<T, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError>;
}

// ---------------------------------------------------------------------------
// Service tag
// ---------------------------------------------------------------------------

export class GitHubClient extends Context.Service<GitHubClient, GitHubClientShape>()(
  "@omnicode/github/GitHubClient",
) {}

// ---------------------------------------------------------------------------
// Helpers – map Octokit errors to our tagged errors
// ---------------------------------------------------------------------------

const classifyGitHubError = (
  operation: string,
  error: unknown,
): GitHubApiError | GitHubNotFoundError | GitHubRateLimitError => {
  const err = error as Record<string, unknown>;
  const status = typeof err.status === "number" ? err.status : 0;
  const message =
    typeof err.message === "string"
      ? err.message
      : `Unknown ${operation} error`;

  if (status === 404) {
    return new GitHubNotFoundError({
      resource: operation,
      message,
    });
  }

  if (status === 403 || status === 429) {
    const headers: Record<string, unknown> = Predicate.isObject(err.headers)
      ? (err.headers as Record<string, unknown>)
      : {};
    const retryAfter = Number(headers["x-ratelimit-reset"] ?? 60);
    return new GitHubRateLimitError({
      retryAfter: Number.isNaN(retryAfter) ? 60 : retryAfter,
      message,
    });
  }

  return new GitHubApiError({
    operation,
    status,
    message,
    cause: error,
  });
};

// ---------------------------------------------------------------------------
// Make / Layer
// ---------------------------------------------------------------------------

export const make = (config: GitHubClientConfig): GitHubClientShape => {
  const octokit = new Octokit(config as unknown as ConstructorParameters<typeof Octokit>[0]);

  const request = <T>(
    operation: string,
    promise: Promise<T>,
  ): Effect.Effect<T, GitHubApiError | GitHubNotFoundError | GitHubRateLimitError> =>
    Effect.tryPromise({
      try: () => promise,
      catch: (error) => classifyGitHubError(operation, error),
    });

  return { octokit, request };
};

export const layer = (config: GitHubClientConfig) =>
  Layer.sync(GitHubClient, () => make(config));
