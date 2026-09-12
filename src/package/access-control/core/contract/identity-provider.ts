/**
 * Credentials are transport-agnostic. The HTTP adapter extracts them from the
 * Authorization header; future workers can create them from another trusted
 * transport without exposing HTTP to the provider.
 */
export interface IdentityCredentials {
  readonly type: "bearer";
  readonly accessToken: string;
}

/** Identity data trusted by the application after credential validation. */
export interface AuthenticatedIdentity {
  /** Stable Ginga Identity subject (`sub` in the future OIDC access token). */
  readonly userId: string;
}

/** Provider boundary. It has no knowledge of roles, permissions, or tenants. */
export abstract class IdentityProvider {
  abstract authenticate(
    credentials: IdentityCredentials,
  ): Promise<AuthenticatedIdentity | null>;
}
