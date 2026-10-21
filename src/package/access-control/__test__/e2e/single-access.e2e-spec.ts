import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Server } from "node:http";
import request from "supertest";
import { appConfigFactory } from "src/config";
import { ConfigModule } from "src/package/shared/module/config";
import { ProblemModule } from "src/package/shared/module/problem";
import { registerHealthRoutes } from "src/package/shared/module/health";
import { AccessControlModule } from "../../index";
import { securityDatabase } from "../support/security-database";

describe("Single-mode HTTP composition", () => {
  let app: INestApplication,
    db: Awaited<ReturnType<typeof securityDatabase>>,
    server: Server;
  beforeAll(async () => {
    db = await securityDatabase("single");
    await db.service.initializeSingleApplication("usr_fake_admin");
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [appConfigFactory] }),
        ProblemModule.forRoot(),
        AccessControlModule.forRoot("single"),
      ],
    })
      .overrideProvider(getDataSourceToken("access-control"))
      .useValue(db.source)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    registerHealthRoutes(app, [db.source]);
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.close();
  });
  it("serves health checks without authentication", async () => {
    await request(server).get("/health/live").expect(200, { status: "ok" });
    await request(server).get("/health/ready").expect(200, { status: "ok" });
  });
  it("authorizes identities through the same guard without a tenant header", async () => {
    await request(server).get("/access/roles").expect(401);
    await request(server)
      .get("/access/roles")
      .set("Authorization", "Bearer fake-token-user-a")
      .expect(403);
    await request(server)
      .get("/access/roles")
      .set("Authorization", "Bearer fake-token-admin")
      .expect(200);
  });
  it("exposes the caller's own access and the permission catalog", async () => {
    const me = await request(server)
      .get("/access/me")
      .set("Authorization", "Bearer fake-token-admin")
      .expect(200);
    expect(me.body).toEqual({
      userId: "usr_fake_admin",
      roleIds: expect.any(Array),
      permissions: expect.arrayContaining(["member:read", "role:assign"]),
    });
    // Single mode: an authenticated identity without assignments has no permissions.
    await request(server)
      .get("/access/me")
      .set("Authorization", "Bearer fake-token-stranger")
      .expect(200, {
        userId: "usr_fake_stranger",
        roleIds: [],
        permissions: [],
      });
    await request(server).get("/access/me").expect(401);
    const catalog = await request(server)
      .get("/access/permissions")
      .set("Authorization", "Bearer fake-token-admin")
      .expect(200);
    expect(catalog.body.groups).toContainEqual({
      resource: "member",
      permissions: [
        "member:read",
        "member:invite",
        "member:update",
        "member:remove",
      ],
    });
    await request(server)
      .get("/access/permissions")
      .set("Authorization", "Bearer fake-token-user-a")
      .expect(403);
  });
  it("refuses tenant headers and does not register tenant signup", async () => {
    await request(server)
      .get("/access/roles")
      .set({
        Authorization: "Bearer fake-token-admin",
        "x-tenant-id": randomUUID(),
      })
      .expect(403);
    await request(server)
      .post("/tenants")
      .set("Authorization", "Bearer fake-token-admin")
      .send({ name: "No tenant", slug: "no-tenant" })
      .expect(404);
  });
});
