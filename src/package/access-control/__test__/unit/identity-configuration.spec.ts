import { ConfigException } from "src/package/shared/module/config";
import { appConfigFactory } from "src/config";
import { OidcIdentityProvider } from "../../core/identity/oidc-identity.provider";

describe("Identity provider configuration", () => {
  const environment = process.env;

  afterEach(() => {
    process.env = environment;
  });

  it("defaults to fake outside production and accepts an explicit future OIDC selection", () => {
    process.env = { ...environment, NODE_ENV: "test" };
    delete process.env.IDENTITY_PROVIDER;
    expect(appConfigFactory().identity.provider).toBe("fake");
    process.env.IDENTITY_PROVIDER = "oidc";
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

  it("fails OIDC selection at bootstrap until the verified adapter exists", () => {
    expect(() => new OidcIdentityProvider()).toThrow(
      "IDENTITY_PROVIDER=oidc requires the Ginga Identity OIDC adapter",
    );
  });
});
