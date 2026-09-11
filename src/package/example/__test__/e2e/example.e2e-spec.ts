import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import request from "supertest";
import { Server } from "node:http";
import { AppModule } from "src/app.module";

describe("Example HTTP API", () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    dataSource = app.get(getDataSourceToken("example"));
  });

  afterAll(async () => app.close());

  it("creates and lists an item", async () => {
    const server = app.getHttpServer() as Server;
    await dataSource.getRepository("example_item").clear();
    await request(server)
      .post("/examples")
      .send({ name: "HTTP item" })
      .expect(201);
    const response = await request(server).get("/examples").expect(200);
    expect(response.body).toEqual([
      expect.objectContaining({ name: "HTTP item", id: expect.any(String) }),
    ]);
  });

  it("rejects an invalid request body", async () => {
    await request(app.getHttpServer() as Server)
      .post("/examples")
      .send({ name: "" })
      .expect(400);
  });
});
