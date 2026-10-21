import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import type { JWK, JWTPayload } from "jose";

/** Real signing and HTTP discovery/JWKS, using disposable test keys only. */
export async function oidcServer() {
  const keyA = await generateKeyPair("RS256");
  const keyB = await generateKeyPair("RS256");
  const key512 = await generateKeyPair("RS512");
  const jwkA = {
    ...(await exportJWK(keyA.publicKey)),
    kid: "A",
    alg: "RS256",
    use: "sig",
  };
  const jwkB = {
    ...(await exportJWK(keyB.publicKey)),
    kid: "B",
    alg: "RS256",
    use: "sig",
  };
  const state = {
    keys: [jwkA] as JWK[],
    discoveryRequests: 0,
    jwksRequests: 0,
    unavailable: false,
    hangDiscovery: false,
    hangJwks: false,
    metadata: {} as Record<string, unknown>,
    userinfo: {
      name: "Test User",
      email: "Test.User@example.com",
      email_verified: true,
    } as Record<string, unknown>,
  };
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/auth/.well-known/openid-configuration") {
      state.discoveryRequests++;
      if (state.hangDiscovery) return;
      res.end(JSON.stringify(state.metadata));
    } else if (req.url === "/userinfo") {
      const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      const sub = token.split(".")[1]
        ? (
            JSON.parse(
              Buffer.from(token.split(".")[1], "base64url").toString(),
            ) as { sub?: string }
          ).sub
        : undefined;
      res.end(JSON.stringify({ sub, ...state.userinfo }));
    } else if (req.url === "/keys") {
      state.jwksRequests++;
      if (state.hangJwks) return;
      res.statusCode = state.unavailable ? 503 : 200;
      res.end(JSON.stringify({ keys: state.keys }));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const issuer = `${origin}/api/auth`;
  const audience = "http://localhost:3000";
  state.metadata = {
    issuer,
    jwks_uri: `${origin}/keys`,
    userinfo_endpoint: `${origin}/userinfo`,
  };
  return {
    issuer,
    audience,
    state,
    jwkA,
    jwkB,
    sign: (
      claims: JWTPayload = {},
      key: "A" | "B" = "A",
      header: Record<string, string> = {},
    ) =>
      new SignJWT({
        iss: issuer,
        aud: audience,
        sub: "usr_test",
        exp: Math.floor(Date.now() / 1000) + 300,
        ...claims,
      })
        .setProtectedHeader({
          alg: "RS256",
          typ: "at+jwt",
          kid: key,
          ...header,
        })
        .sign(
          header.alg === "RS512"
            ? key512.privateKey
            : key === "A"
              ? keyA.privateKey
              : keyB.privateKey,
        ),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
