import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { oidcUrlSchema } from "src/config";
import {
  AuthenticatedIdentity,
  IdentityCredentials,
  IdentityProvider,
} from "../contract/identity-provider";

const NETWORK_TIMEOUT_MS = 5000;

/** Resource server adapter for Ginga Identity RS256 access tokens. */
export class OidcIdentityProvider extends IdentityProvider {
  private constructor(
    private readonly issuer: string,
    private readonly audience: string,
    private readonly keys: ReturnType<typeof createRemoteJWKSet>,
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
        })
        .parse(await response.json());
      const keys = createRemoteJWKSet(new URL(metadata.jwks_uri), {
        timeoutDuration: NETWORK_TIMEOUT_MS,
        cacheMaxAge: 600_000,
        cooldownDuration: 30_000,
      });
      return new OidcIdentityProvider(issuer, audience, keys);
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
}
