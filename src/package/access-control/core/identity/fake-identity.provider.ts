import { Injectable } from "@nestjs/common";
import type { IdentityProfile } from "../model/access.model";
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
  "fake-token-invitee": Object.freeze({ userId: "usr_fake_invitee" }),
});

/** Display profiles of the fake identities; the invitee proves a verified email. */
export const FAKE_IDENTITY_PROFILES: Readonly<Record<string, IdentityProfile>> =
  Object.freeze({
    usr_fake_a: {
      displayName: "User A",
      email: "user-a@example.com",
      emailVerified: true,
    },
    usr_fake_b: {
      displayName: "User B",
      email: "user-b@example.com",
      emailVerified: true,
    },
    usr_fake_admin: {
      displayName: "Admin",
      email: "admin@example.com",
      emailVerified: true,
    },
    usr_fake_stranger: {
      displayName: "Stranger",
      email: "stranger@example.com",
      emailVerified: false,
    },
    usr_fake_invitee: {
      displayName: "Invitee",
      email: "invitee@example.com",
      emailVerified: true,
    },
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

  profile(credentials: IdentityCredentials): Promise<IdentityProfile | null> {
    const identity = FAKE_IDENTITY_TOKENS[credentials.accessToken];
    const profile = identity && FAKE_IDENTITY_PROFILES[identity.userId];
    return Promise.resolve(profile ? { ...profile } : null);
  }
}
