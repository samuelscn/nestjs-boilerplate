import { ConfigException } from "src/package/shared/module/config";
import { appConfigFactory } from "src/config";
import { createIdentityProvider } from "../../core/identity/identity-provider.factory";
import { FakeIdentityProvider } from "../../core/identity/fake-identity.provider";

describe("Identity provider configuration", () => {
  const environment = process.env;

  afterEach(() => {
    process.env = environment;
  });

  it("defaults to fake outside production and accepts configured OIDC", () => {
    process.env = { ...environment, NODE_ENV: "test" };
    delete process.env.IDENTITY_PROVIDER;
    expect(appConfigFactory().identity.provider).toBe("fake");
    process.env.IDENTITY_PROVIDER = "oidc";
    process.env.OIDC_ISSUER = "http://localhost:4000/api/auth";
    process.env.OIDC_AUDIENCE = "http://localhost:3000";
    expect(appConfigFactory().identity.provider).toBe("oidc");
  });

  it("refuses fake identity in production", () => {
    process.env = {
      ...environment,
      NODE_ENV: "production",
      IDENTITY_PROVIDER: "fake",
    };
    expect(() => appConfigFactory()).toThrow(ConfigException);
  });

  it.each(["test", "development"])(
    "selects fake in %s",
    async (environmentName) => {
      process.env = { ...environment, NODE_ENV: environmentName };
      await expect(
        createIdentityProvider({ provider: "fake" }),
      ).resolves.toBeInstanceOf(FakeIdentityProvider);
    },
  );

  it("also refuses an explicit fake adapter selection in production", () => {
    process.env = { ...environment, NODE_ENV: "production" };
    expect(() =>
      createIdentityProvider(
        {
          provider: "oidc",
          issuer: "https://identity.example/api/auth",
          audience: "api",
        },
        "fake",
      ),
    ).toThrow("only allowed outside production");
  });

  it.each([
    [undefined, "api"],
    ["not-a-url", "api"],
    ["https://identity.example", undefined],
    ["https://identity.example", " "],
    ["https://user:password@identity.example", "api"],
    ["https://identity.example?token=secret", "api"],
    ["http://identity.example", "api"],
  ])("rejects invalid OIDC configuration", (issuer, audience) => {
    process.env = { ...environment, IDENTITY_PROVIDER: "oidc" };
    delete process.env.OIDC_ISSUER;
    delete process.env.OIDC_AUDIENCE;
    if (issuer !== undefined) process.env.OIDC_ISSUER = issuer;
    if (audience !== undefined) process.env.OIDC_AUDIENCE = audience;
    expect(() => appConfigFactory()).toThrow(ConfigException);
  });

  it("requires HTTPS in production", () => {
    process.env = {
      ...environment,
      NODE_ENV: "production",
      IDENTITY_PROVIDER: "oidc",
      OIDC_ISSUER: "http://localhost:4000/api/auth",
      OIDC_AUDIENCE: "api",
    };
    expect(() => appConfigFactory()).toThrow(ConfigException);
  });
});
