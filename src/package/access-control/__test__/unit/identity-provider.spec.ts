import type { Request } from "express";
import {
  FAKE_IDENTITY_TOKENS,
  FakeIdentityProvider,
} from "../../core/identity/fake-identity.provider";
import { bearerIdentityCredentials } from "../../http/rest/bearer-identity-credentials";

describe("FakeIdentityProvider", () => {
  const provider = new FakeIdentityProvider();

  it("maps only documented fake Bearer credentials to stable external subjects", async () => {
    await expect(
      provider.authenticate({
        type: "bearer",
        accessToken: "fake-token-user-a",
      }),
    ).resolves.toEqual({ userId: "usr_fake_a" });
    await expect(
      provider.authenticate({
        type: "bearer",
        accessToken: "fake-token-user-b",
      }),
    ).resolves.toEqual({ userId: "usr_fake_b" });
    await expect(
      provider.authenticate({
        type: "bearer",
        accessToken: "fake-token-user-a",
      }),
    ).resolves.not.toHaveProperty("roles");
    expect(FAKE_IDENTITY_TOKENS).toEqual(
      expect.objectContaining({
        "fake-token-admin": { userId: "usr_fake_admin" },
      }),
    );
  });

  it("does not mint identities from unknown or malformed credentials", async () => {
    await expect(
      provider.authenticate({ type: "bearer", accessToken: "usr_attacker" }),
    ).resolves.toBeNull();
    await expect(
      provider.authenticate({ type: "bearer", accessToken: "" }),
    ).resolves.toBeNull();
  });
});

describe("Bearer credential extraction", () => {
  const request = (authorization: string | undefined, occurrences = 1) =>
    ({
      headers: { authorization },
      rawHeaders: Array.from({ length: occurrences }, () => [
        "Authorization",
        authorization ?? "",
      ]).flat(),
    }) as unknown as Request;

  it.each([
    [undefined, 1],
    ["Basic fake-token-user-a", 1],
    ["Bearer", 1],
    ["Bearer fake token", 1],
    ["Bearer fake-token-user-a", 2],
  ])(
    "rejects non-singular or non-Bearer credentials: %s",
    (authorization, occurrences) => {
      expect(
        bearerIdentityCredentials(request(authorization, occurrences)),
      ).toBeNull();
    },
  );

  it("extracts a single opaque Bearer token without authenticating it", () => {
    expect(
      bearerIdentityCredentials(request("Bearer fake-token-user-a")),
    ).toEqual({
      type: "bearer",
      accessToken: "fake-token-user-a",
    });
  });
});
