import { z } from "zod";
import { ConfigException } from "src/package/shared/module/config";
import { SharedConfig } from "src/package/shared/module/config/util/shared.config";

const appConfigSchema = z.object({
  app: z.object({ port: z.coerce.number().int().positive().default(3000) }),
  identity: z.object({
    provider: z.enum(["fake", "oidc"]).default("fake"),
  }),
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
    identity: { provider: process.env.IDENTITY_PROVIDER },
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
