import {
  Body,
  Controller,
  Get,
  INestApplication,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IsEmail, IsNotEmpty, IsString, Min } from "class-validator";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Server } from "node:http";
import request from "supertest";
import { AccessError } from "src/package/shared/module/authorization";
import { DomainError, ErrorCode, ProblemModule } from "..";

class ProbeDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEmail() email!: string;
  @Min(18, { context: { params: { min: 18 } } }) age!: number;
}

@Controller("probe")
class ProbeController {
  @Post("validation") validation(@Body() body: ProbeDto) {
    return body;
  }
  @Get("unauthenticated") unauthenticated() {
    throw new UnauthorizedException();
  }
  @Get("forbidden") forbidden() {
    throw new AccessError("forbidden");
  }
  @Get("not-found") notFound() {
    throw new DomainError("not_found", ErrorCode.RESOURCE_NOT_FOUND);
  }
  @Get("conflict") conflict() {
    throw new AccessError("conflict", "LAST_OWNER_REQUIRED");
  }
  @Get("rule") rule() {
    throw new DomainError("rule", "CATEGORY_FULL", {
      params: { maxParticipants: 32 },
      detail: "The category has reached its capacity.",
    });
  }
  @Get("rate-limit") rateLimit() {
    throw new DomainError("rate_limit", ErrorCode.RATE_LIMIT_EXCEEDED, {
      retryAfterSeconds: 30,
    });
  }
  @Get("crash") crash() {
    throw new Error("select * from secrets where password = 'hunter2'");
  }
  @Get("domain-crash") domainCrash() {
    throw new DomainError("unavailable", "SERVICE_UNAVAILABLE", {
      detail: "upstream db-primary.internal:5432 refused",
      params: { host: "db-primary.internal" },
    });
  }
}

type Fixture = {
  request: {
    method: "GET" | "POST";
    path: string;
    body?: object;
    rawBody?: string;
  };
  response: { status: number; headers?: Record<string, string>; body: object };
};
const fixtures = JSON.parse(
  readFileSync(
    join(__dirname, "../../../../../../contracts/problem-fixtures.json"),
    "utf8",
  ),
) as { cases: Record<string, Fixture> };

describe("Problem Details contract (RFC 9457)", () => {
  let app: INestApplication;
  let server: Server;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ProblemModule.forRoot()],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    await app?.close();
  });

  it.each(Object.entries(fixtures.cases))(
    "%s matches the published fixture",
    async (_name, fixture) => {
      const call =
        fixture.request.method === "POST"
          ? request(server).post(fixture.request.path)
          : request(server).get(fixture.request.path);
      if (fixture.request.rawBody !== undefined)
        call
          .set("Content-Type", "application/json")
          .send(fixture.request.rawBody);
      else if (fixture.request.body !== undefined)
        call.send(fixture.request.body);
      const response = await call;
      expect(response.status).toBe(fixture.response.status);
      expect(response.headers["content-type"]).toBe(
        "application/problem+json; charset=utf-8",
      );
      for (const [header, value] of Object.entries(
        fixture.response.headers ?? {},
      ))
        expect(response.headers[header.toLowerCase()]).toBe(value);
      const body = JSON.parse(response.text) as Record<string, unknown>;
      expect(body.traceId).toBe(response.headers["x-correlation-id"]);
      expect(new Date(body.timestamp as string).toISOString()).toBe(
        body.timestamp,
      );
      expect({
        ...body,
        traceId: "<traceId>",
        timestamp: "<timestamp>",
      }).toEqual(fixture.response.body);
    },
  );

  it("propagates a valid incoming correlation id as traceId", async () => {
    const id = "6f1c3e2a-9b7d-4c1e-8a2b-3d4e5f6a7b8c";
    const response = await request(server)
      .get("/probe/forbidden")
      .set("x-correlation-id", id)
      .expect(403);
    expect(response.headers["x-correlation-id"]).toBe(id);
    expect(JSON.parse(response.text)).toMatchObject({ traceId: id });
  });

  it("never leaks internals on 5xx", async () => {
    for (const path of ["/probe/crash", "/probe/domain-crash"]) {
      const response = await request(server).get(path);
      expect(response.text).not.toMatch(/select|hunter2|db-primary|stack/i);
    }
  });
});
