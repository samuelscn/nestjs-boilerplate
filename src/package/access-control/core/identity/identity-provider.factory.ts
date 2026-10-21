import { AppConfig } from "src/config";
import { IdentityProvider } from "../contract/identity-provider";
import { FakeIdentityProvider } from "./fake-identity.provider";
import { OidcIdentityProvider } from "./oidc-identity.provider";

export function createIdentityProvider(
  config: AppConfig["identity"],
  selection = config.provider,
): Promise<IdentityProvider> {
  if (selection === "fake") {
    if (process.env.NODE_ENV === "production")
      throw new Error(
        "IDENTITY_PROVIDER=fake is only allowed outside production",
      );
    return Promise.resolve(new FakeIdentityProvider());
  }
  if (config.provider !== "oidc")
    throw new Error(
      "OIDC requires validated issuer and audience configuration",
    );
  return OidcIdentityProvider.create(config);
}
