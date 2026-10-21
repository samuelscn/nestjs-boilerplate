import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import type { Server } from "node:http";
import request from "supertest";
import { appConfigFactory } from "src/config";
import { ConfigModule } from "src/package/shared/module/config";
import {
  Permission,
  RequestContexts,
} from "src/package/shared/module/authorization";
import { AccessControlModule } from "../../access-control.module";
import { RequirePermission } from "../../http/rest/permission.decorator";
import { oidcServer } from "../support/oidc-server";
import { securityDatabase } from "../support/security-database";

@Controller("auth-test")
class IdentityTestController {
  constructor(private readonly contexts: RequestContexts) {}

  @Get("me")
  @RequirePermission(Permission.role.read)
  me() {
    return this.contexts.current().identity;
  }
}

describe("OIDC HTTP resource server", () => {
  let identity: Awaited<ReturnType<typeof oidcServer>>;
  let db: Awaited<ReturnType<typeof securityDatabase>>;
  let app: INestApplication;
  let server: Server;
  beforeAll(async () => {
    identity = await oidcServer();
    db = await securityDatabase("single");
    await db.service.initializeSingleApplication("usr_test");
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [
            () => ({
              ...appConfigFactory(),
              identity: {
                provider: "oidc",
                issuer: identity.issuer,
                audience: identity.audience,
              },
            }),
          ],
        }),
        AccessControlModule.forRoot("single"),
      ],
      controllers: [IdentityTestController],
    })
      .overrideProvider(getDataSourceToken("access-control"))
      .useValue(db.source)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    await app?.close();
    await db?.close();
    await identity?.close();
  });

  it("propagates verified sub through real guard, local RBAC and RequestContext", async () => {
    await request(server)
      .get("/auth-test/me")
      .set("Authorization", `Bearer ${await identity.sign()}`)
      .expect(200, { userId: "usr_test" });
    await request(server)
      .get("/auth-test/me")
      .set(
        "Authorization",
        `Bearer ${await identity.sign({ sub: "usr_without_local_roles", roles: ["admin"] })}`,
      )
      .expect(403);
  });

  it.each([
    undefined,
    "Basic secret",
    "Bearer ",
    "Bearer malformed",
    "Bearer a.b.c",
  ])("uses official 401 envelope for header %s", async (authorization) => {
    const call = request(server).get("/auth-test/me");
    if (authorization !== undefined) call.set("Authorization", authorization);
    const response = await call.expect(401);
    expect(response.body).toEqual({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      requestId: expect.any(String),
      timestamp: expect.any(String),
      path: "/auth-test/me",
    });
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
    expect(response.headers["www-authenticate"]).toBe("Bearer");
  });

  it("does not accept query or body tokens", async () => {
    const token = await identity.sign();
    await request(server)
      .get("/auth-test/me")
      .query({ access_token: token })
      .expect(401);
    await request(server)
      .get("/auth-test/me")
      .send({ access_token: token })
      .expect(401);
  });

  it("does not disclose the JWT validation failure", async () => {
    const tokens = await Promise.all([
      identity.sign({ iss: "https://wrong.example" }),
      identity.sign({ aud: "wrong-api" }),
      identity.sign({ exp: 1 }),
      identity.sign({ sub: undefined }),
      identity.sign({}, "B", { kid: "A" }),
      identity.sign({}, "A", { typ: "JWT" }),
      identity.sign({}, "A", { alg: "RS512" }),
    ]);
    for (const token of tokens) {
      const response = await request(server)
        .get("/auth-test/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(401);
      expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
      expect(response.body.message).toBe("Authentication is required.");
      expect(JSON.stringify(response.body)).not.toContain(token);
    }
  });
});
