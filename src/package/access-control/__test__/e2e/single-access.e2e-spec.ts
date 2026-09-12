import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { Server } from "node:http";
import request from "supertest";
import { appConfigFactory } from "src/config";
import { ConfigModule } from "src/package/shared/module/config";
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
        AccessControlModule.forRoot("single"),
      ],
    })
      .overrideProvider(getDataSourceToken("access-control"))
      .useValue(db.source)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.close();
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
