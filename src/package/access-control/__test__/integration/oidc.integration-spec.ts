import { SignJWT, UnsecuredJWT } from "jose";
import { createIdentityProvider } from "../../core/identity/identity-provider.factory";
import { OidcIdentityProvider } from "../../core/identity/oidc-identity.provider";
import { oidcServer } from "../support/oidc-server";

describe("OIDC cryptographic validation and remote JWKS", () => {
  let server: Awaited<ReturnType<typeof oidcServer>>;
  let provider: OidcIdentityProvider;
  const authenticate = (accessToken: string) =>
    provider.authenticate({ type: "bearer", accessToken });
  beforeAll(async () => {
    server = await oidcServer();
  });
  beforeEach(async () => {
    server.state.keys = [server.jwkA];
    server.state.unavailable = false;
    server.state.hangDiscovery = false;
    server.state.hangJwks = false;
    provider = await OidcIdentityProvider.create(server);
  });
  afterAll(async () => {
    await server?.close();
  });

  it("selects OIDC and maps verified sub only", async () => {
    const selected = await createIdentityProvider({
      provider: "oidc",
      issuer: server.issuer,
      audience: server.audience,
    });
    expect(selected).toBeInstanceOf(OidcIdentityProvider);
    await expect(
      selected.authenticate({
        type: "bearer",
        accessToken: await server.sign({
          email: "ignored@example.com",
          roles: ["admin"],
          tenant: "ignored",
        }),
      }),
    ).resolves.toEqual({ userId: "usr_test" });
  });

  it("reads the display profile from UserInfo with the caller's own token", async () => {
    const credentials = {
      type: "bearer" as const,
      accessToken: await server.sign(),
    };
    await expect(provider.profile(credentials)).resolves.toEqual({
      displayName: "Test User",
      email: "test.user@example.com",
      emailVerified: true,
    });
    server.state.userinfo = { sub: "someone-else", email: "x@example.com" };
    await expect(provider.profile(credentials)).resolves.toBeNull();
    server.state.userinfo = { name: "Unverified", email: "u@example.com" };
    await expect(provider.profile(credentials)).resolves.toMatchObject({
      emailVerified: false,
    });
    await expect(
      provider.profile({
        type: "bearer",
        accessToken: await server.sign({ exp: 1 }),
      }),
    ).resolves.toBeNull();
    server.state.userinfo = {
      name: "Test User",
      email: "Test.User@example.com",
      email_verified: true,
    };
  });

  it.each([
    ["wrong issuer", { iss: "https://attacker.example" }],
    ["wrong audience", { aud: "another-api" }],
    ["expired", { exp: 1 }],
    ["missing exp", { exp: undefined }],
    ["future nbf", { nbf: 9_999_999_999 }],
    ["missing sub", { sub: undefined }],
    ["empty sub", { sub: " " }],
    ["long sub", { sub: "x".repeat(256) }],
  ])("denies %s", async (_reason, claims) => {
    await expect(authenticate(await server.sign(claims))).resolves.toBeNull();
  });

  it("accepts audience arrays containing this resource", async () => {
    await expect(
      authenticate(
        await server.sign({ aud: ["another-api", server.audience] }),
      ),
    ).resolves.toEqual({ userId: "usr_test" });
  });

  it("allows only the documented five-second clock tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(
      authenticate(await server.sign({ exp: now - 3 })),
    ).resolves.toEqual({ userId: "usr_test" });
    await expect(
      authenticate(await server.sign({ exp: now - 7 })),
    ).resolves.toBeNull();
  });

  it("bounds discovery and JWKS network waits", async () => {
    server.state.hangDiscovery = true;
    const started = Date.now();
    await expect(OidcIdentityProvider.create(server)).rejects.toThrow(
      "OIDC discovery failed",
    );
    expect(Date.now() - started).toBeLessThan(8000);
    server.state.hangDiscovery = false;
    server.state.hangJwks = true;
    const jwksStarted = Date.now();
    await expect(authenticate(await server.sign())).resolves.toBeNull();
    expect(Date.now() - jwksStarted).toBeLessThan(8000);
  });

  it.each(["JWT", "id+jwt", ""])(
    "rejects non-access token type %s",
    async (typ) => {
      await expect(
        authenticate(await server.sign({}, "A", { typ })),
      ).resolves.toBeNull();
    },
  );

  it("rejects unknown keys, forged signatures and altered tokens", async () => {
    await expect(authenticate(await server.sign({}, "B"))).resolves.toBeNull();
    await expect(
      authenticate(await server.sign({}, "B", { kid: "A" })),
    ).resolves.toBeNull();
    const token = await server.sign();
    const [header, payload, signature] = token.split(".");
    const altered = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, "base64url").toString()),
        sub: "attacker",
      }),
    ).toString("base64url");
    await expect(
      authenticate(`${header}.${altered}.${signature}`),
    ).resolves.toBeNull();
  });

  it("rejects none, HS256, RS512 and malformed JWTs", async () => {
    const unsigned = new UnsecuredJWT({ sub: "attacker" }).encode();
    const symmetric = await new SignJWT({ sub: "attacker" })
      .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
      .sign(new Uint8Array(32));
    const unexpected = await server.sign({}, "A", { alg: "RS512" });
    for (const token of [
      unsigned,
      symmetric,
      unexpected,
      "malformed",
      "a.b.c",
      "",
    ])
      await expect(authenticate(token)).resolves.toBeNull();
  });

  it("caches discovery/JWKS and continues during outage while keys are fresh", async () => {
    const token = await server.sign();
    const discoveries = server.state.discoveryRequests;
    const requests = server.state.jwksRequests;
    await Promise.all(Array.from({ length: 5 }, () => authenticate(token)));
    expect(server.state.jwksRequests).toBe(requests + 1);
    server.state.unavailable = true;
    await expect(authenticate(token)).resolves.toEqual({ userId: "usr_test" });
    expect(server.state.jwksRequests).toBe(requests + 1);
    expect(server.state.discoveryRequests).toBe(discoveries);
  });

  it("refreshes unknown kid after cooldown and follows published rotation keys", async () => {
    const tokenA = await server.sign();
    const tokenB = await server.sign({}, "B");
    await expect(authenticate(tokenA)).resolves.toEqual({ userId: "usr_test" });
    const requests = server.state.jwksRequests;
    server.state.keys = [server.jwkA, server.jwkB];
    await expect(authenticate(tokenB)).resolves.toBeNull();
    expect(server.state.jwksRequests).toBe(requests);
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + 31_000);
    await expect(authenticate(tokenB)).resolves.toEqual({ userId: "usr_test" });
    await expect(authenticate(tokenA)).resolves.toEqual({ userId: "usr_test" });
    expect(server.state.jwksRequests).toBe(requests + 1);
    server.state.keys = [server.jwkB];
    jest.spyOn(Date, "now").mockReturnValue(now + 632_000);
    await expect(authenticate(tokenB)).resolves.toEqual({ userId: "usr_test" });
    await expect(authenticate(tokenA)).resolves.toBeNull();
  });

  it("fails closed with expired cache during outage and recovers", async () => {
    const token = await server.sign();
    await authenticate(token);
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + 601_000);
    server.state.unavailable = true;
    await expect(authenticate(token)).resolves.toBeNull();
    server.state.unavailable = false;
    await expect(authenticate(token)).resolves.toEqual({ userId: "usr_test" });
  });

  it("rejects discovery with mismatched issuer or insecure JWKS URL", async () => {
    const metadata = server.state.metadata;
    try {
      server.state.metadata = { ...metadata, issuer: "https://wrong.example" };
      await expect(OidcIdentityProvider.create(server)).rejects.toThrow(
        "OIDC discovery failed",
      );
      server.state.metadata = {
        ...metadata,
        jwks_uri: "http://remote.example/keys",
      };
      await expect(OidcIdentityProvider.create(server)).rejects.toThrow(
        "OIDC discovery failed",
      );
    } finally {
      server.state.metadata = metadata;
    }
  });
});
