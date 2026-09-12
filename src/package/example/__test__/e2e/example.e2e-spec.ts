import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import request from "supertest";
import { Server } from "node:http";
import { AppModule } from "src/app.module";
import { securityDatabase } from "src/package/access-control/__test__/support/security-database";

describe("Example HTTP API", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let security: Awaited<ReturnType<typeof securityDatabase>>;

  beforeAll(async () => {
    security = await securityDatabase("single");
    await security.service.initializeSingleApplication("usr_fake_admin");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken("access-control"))
      .useValue(security.source)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    dataSource = app.get(getDataSourceToken("example"));
  });

  afterAll(async () => {
    if (app) await app.close();
    if (security) await security.close();
  });

  it("creates and lists an item", async () => {
    const server = app.getHttpServer() as Server;
    await dataSource.getRepository("example_item").clear();
    await request(server)
      .post("/examples")
      .set("Authorization", "Bearer fake-token-admin")
      .send({ name: "HTTP item" })
      .expect(201);
    const response = await request(server)
      .get("/examples")
      .set("Authorization", "Bearer fake-token-admin")
      .expect(200);
    expect(response.body).toEqual([
      expect.objectContaining({ name: "HTTP item", id: expect.any(String) }),
    ]);
  });

  it("rejects an invalid request body", async () => {
    await request(app.getHttpServer() as Server)
      .post("/examples")
      .set("Authorization", "Bearer fake-token-admin")
      .send({ name: "" })
      .expect(400);
  });
});
