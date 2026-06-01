import type {
  AuthEnvironmentScope,
  AuthPairingLink,
  ServerAuthBootstrapMethod,
} from "@t3tools/contracts";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";

export interface BootstrapGrant {
  readonly method: ServerAuthBootstrapMethod;
  readonly scopes: ReadonlyArray<AuthEnvironmentScope>;
  readonly subject: string;
  readonly label?: string;
  readonly expiresAt: DateTime.DateTime;
}

export class BootstrapCredentialInvalidError extends Data.TaggedError(
  "BootstrapCredentialInvalidError",
)<{
  readonly message: string;
}> {}

export class BootstrapCredentialInternalError extends Data.TaggedError(
  "BootstrapCredentialInternalError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export type BootstrapCredentialError =
  | BootstrapCredentialInvalidError
  | BootstrapCredentialInternalError;

export interface IssuedBootstrapCredential {
  readonly id: string;
  readonly credential: string;
  readonly label?: string;
  readonly expiresAt: DateTime.Utc;
}

export type BootstrapCredentialChange =
  | {
      readonly type: "pairingLinkUpserted";
      readonly pairingLink: AuthPairingLink;
    }
  | {
      readonly type: "pairingLinkRemoved";
      readonly id: string;
    };

export interface BootstrapCredentialServiceShape {
  readonly issueOneTimeToken: (input?: {
    readonly ttl?: Duration.Duration;
    readonly scopes?: ReadonlyArray<AuthEnvironmentScope>;
    readonly subject?: string;
    readonly label?: string;
  }) => Effect.Effect<IssuedBootstrapCredential, BootstrapCredentialInternalError>;
  readonly listActive: () => Effect.Effect<
    ReadonlyArray<AuthPairingLink>,
    BootstrapCredentialInternalError
  >;
  readonly streamChanges: Stream.Stream<BootstrapCredentialChange>;
  readonly revoke: (id: string) => Effect.Effect<boolean, BootstrapCredentialInternalError>;
  readonly consume: (credential: string) => Effect.Effect<BootstrapGrant, BootstrapCredentialError>;
}

export class BootstrapCredentialService extends Context.Service<
  BootstrapCredentialService,
  BootstrapCredentialServiceShape
>()("t3/auth/Services/BootstrapCredentialService") {}
