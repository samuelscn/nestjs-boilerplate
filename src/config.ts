import { z } from "zod";
import { ConfigException } from "src/package/shared/module/config";
import { SharedConfig } from "src/package/shared/module/config/util/shared.config";

export const oidcUrlSchema = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    (url.protocol === "https:" ||
      (process.env.NODE_ENV !== "production" &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  );
}, "OIDC URLs must use HTTPS (HTTP loopback is allowed outside production)");

const appConfigSchema = z.object({
  app: z.object({ port: z.coerce.number().int().positive().default(3000) }),
  identity: z.discriminatedUnion("provider", [
    z.object({ provider: z.literal("fake") }),
    z.object({
      provider: z.literal("oidc"),
      issuer: oidcUrlSchema,
      audience: z.string().trim().min(1),
    }),
  ]),
  authorization: z.object({
    mode: z.enum(["single", "tenant"]).default("single"),
  }),
  database: z.object({
    host: z.string().min(1),
    port: z.coerce.number().int().positive().default(5432),
    username: z.string().min(1),
    password: z.string(),
    name: z.string().min(1),
  }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type ApplicationConfig = AppConfig & SharedConfig;

export const appConfigFactory = (): AppConfig => {
  const result = appConfigSchema.safeParse({
    app: { port: process.env.APP_PORT },
    identity: {
      provider: process.env.IDENTITY_PROVIDER ?? "fake",
      issuer: process.env.OIDC_ISSUER,
      audience: process.env.OIDC_AUDIENCE,
    },
    authorization: { mode: process.env.AUTHORIZATION_MODE },
    database: {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      name: process.env.DATABASE_NAME,
    },
  });
  if (result.success) {
    if (
      process.env.NODE_ENV === "production" &&
      result.data.identity.provider === "fake"
    )
      throw new ConfigException(
        "IDENTITY_PROVIDER=fake is only allowed outside production",
      );
    return result.data;
  }
  throw new ConfigException(
    `Invalid application configuration: ${result.error.message}`,
  );
};
