import { Injectable } from "@nestjs/common";
import {
  AuthenticatedIdentity,
  IdentityCredentials,
  IdentityProvider,
} from "../contract/identity-provider";

/**
 * Development/test stand-in for Ginga Identity. Its finite map deliberately
 * prevents callers from minting identities by choosing an arbitrary token.
 */
export const FAKE_IDENTITY_TOKENS: Readonly<
  Record<string, AuthenticatedIdentity>
> = Object.freeze({
  "fake-token-user-a": Object.freeze({ userId: "usr_fake_a" }),
  "fake-token-user-b": Object.freeze({ userId: "usr_fake_b" }),
  "fake-token-admin": Object.freeze({ userId: "usr_fake_admin" }),
  "fake-token-stranger": Object.freeze({ userId: "usr_fake_stranger" }),
});

@Injectable()
export class FakeIdentityProvider extends IdentityProvider {
  constructor() {
    super();
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "FakeIdentityProvider is only allowed outside production",
      );
  }

  authenticate(
    credentials: IdentityCredentials,
  ): Promise<AuthenticatedIdentity | null> {
    const identity = FAKE_IDENTITY_TOKENS[credentials.accessToken];
    return Promise.resolve(identity ? Object.freeze({ ...identity }) : null);
  }
}
