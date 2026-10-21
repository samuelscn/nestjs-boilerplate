import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { oidcUrlSchema } from "src/config";
import type { IdentityProfile } from "../model/access.model";
import {
  AuthenticatedIdentity,
  IdentityCredentials,
  IdentityProvider,
} from "../contract/identity-provider";

const NETWORK_TIMEOUT_MS = 5000;
const userinfoSchema = z.object({
  sub: z.string().min(1).max(255),
  name: z.string().max(500).optional(),
  email: z.email().max(254).optional(),
  email_verified: z.boolean().optional(),
});

/** Resource server adapter for Ginga Identity RS256 access tokens. */
export class OidcIdentityProvider extends IdentityProvider {
  private constructor(
    private readonly issuer: string,
    private readonly audience: string,
    private readonly keys: ReturnType<typeof createRemoteJWKSet>,
    private readonly userinfoEndpoint?: string,
  ) {
    super();
  }

  static async create(config: {
    issuer: string;
    audience: string;
  }): Promise<OidcIdentityProvider> {
    const issuer = oidcUrlSchema.parse(config.issuer);
    const audience = z.string().trim().min(1).parse(config.audience);
    // Discovery is trusted only through the configured issuer, never token claims.
    try {
      const response = await fetch(
        `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
        { signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS), redirect: "error" },
      );
      if (!response.ok) throw new Error("Discovery unavailable");
      const metadata = z
        .object({
          issuer: z.literal(issuer),
          jwks_uri: oidcUrlSchema,
          userinfo_endpoint: oidcUrlSchema.optional(),
        })
        .parse(await response.json());
      const keys = createRemoteJWKSet(new URL(metadata.jwks_uri), {
        timeoutDuration: NETWORK_TIMEOUT_MS,
        cacheMaxAge: 600_000,
        cooldownDuration: 30_000,
      });
      return new OidcIdentityProvider(
        issuer,
        audience,
        keys,
        metadata.userinfo_endpoint,
      );
    } catch {
      // Do not propagate response bodies, URLs with credentials or provider errors.
      throw new Error(
        "OIDC discovery failed; check issuer metadata and availability",
      );
    }
  }

  async authenticate(
    credentials: IdentityCredentials,
  ): Promise<AuthenticatedIdentity | null> {
    try {
      if (credentials.type !== "bearer" || !credentials.accessToken)
        return null;
      const { payload } = await jwtVerify(credentials.accessToken, this.keys, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ["RS256"],
        typ: "at+jwt",
        requiredClaims: ["iss", "aud", "exp", "sub"],
        clockTolerance: 5,
      });
      if (!payload.sub?.trim() || payload.sub.length > 255) return null;
      return Object.freeze({ userId: payload.sub });
    } catch {
      // All failures share the existing unauthenticated contract. Never log JWTs.
      return null;
    }
  }

  /** OIDC UserInfo with the caller's own token; the subject must match the verified token. */
  async profile(
    credentials: IdentityCredentials,
  ): Promise<IdentityProfile | null> {
    if (!this.userinfoEndpoint) return null;
    const identity = await this.authenticate(credentials);
    if (!identity) return null;
    try {
      const response = await fetch(this.userinfoEndpoint, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
        redirect: "error",
      });
      if (!response.ok) return null;
      const claims = userinfoSchema.parse(await response.json());
      if (claims.sub !== identity.userId) return null;
      return {
        displayName: claims.name?.trim().slice(0, 120) || null,
        email: claims.email?.toLowerCase() ?? null,
        emailVerified: claims.email_verified === true,
      };
    } catch {
      return null;
    }
  }
}
