import { Injectable } from "@nestjs/common";
import { IdentityProvider } from "../contract/identity-provider";

/**
 * Reserved composition point for the Ginga Identity OIDC adapter. It must
 * validate the JWT signature through JWKS plus issuer, audience and expiry,
 * then return `{ userId: claims.sub }` through IdentityProvider.
 */
@Injectable()
export class OidcIdentityProvider extends IdentityProvider {
  constructor() {
    super();
    throw new Error(
      "IDENTITY_PROVIDER=oidc requires the Ginga Identity OIDC adapter; it is not installed in this boilerplate yet",
    );
  }

  authenticate(): never {
    throw new Error("Unreachable: OIDC provider failed during bootstrap");
  }
}
