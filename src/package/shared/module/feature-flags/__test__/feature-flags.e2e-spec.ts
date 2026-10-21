import { Controller, Get, INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Server } from "node:http";
import request from "supertest";
import { ProblemModule } from "../../problem";
import { FeatureFlag, FeatureFlags, FeatureFlagsModule, parseFlags } from "..";

const definitions = {
  enabled: {
    default: true,
    description: "",
    owner: "test",
    removeBy: "2099-01-01",
  },
  disabled: {
    default: false,
    description: "",
    owner: "test",
    removeBy: "2099-01-01",
  },
} as const;

@Controller("flagged")
class FlaggedController {
  constructor(private readonly flags: FeatureFlags) {}
  @Get("on") @FeatureFlag("enabled") on() {
    return { variant: this.flags.isEnabled("disabled") ? "b" : "a" };
  }
  @Get("off") @FeatureFlag("disabled") off() {
    return { reached: true };
  }
}

describe("feature flags", () => {
  let app: INestApplication;
  let server: Server;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ProblemModule.forRoot(),
        FeatureFlagsModule.forRoot(parseFlags(definitions, undefined)),
      ],
      controllers: [FlaggedController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    server = app.getHttpServer() as Server;
  });
  afterAll(async () => {
    await app?.close();
  });

  it("resolves defaults and overrides, refusing unknown names and values", () => {
    expect(parseFlags(definitions, " disabled = true ")).toEqual({
      enabled: true,
      disabled: true,
    });
    for (const value of ["disabld=true", "enabled=yes", "enabled"])
      expect(() => parseFlags(definitions, value)).toThrow(
        "Invalid feature flag",
      );
  });

  it("serves enabled routes and answers 404 problem for disabled ones", async () => {
    await request(server).get("/flagged/on").expect(200, { variant: "a" });
    const response = await request(server).get("/flagged/off").expect(404);
    expect(JSON.parse(response.text)).toMatchObject({
      code: "RESOURCE_NOT_FOUND",
      status: 404,
    });
  });
});
