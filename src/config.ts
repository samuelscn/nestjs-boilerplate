import { z } from "zod";
import { ConfigException } from "src/package/shared/module/config";
import { SharedConfig } from "src/package/shared/module/config/util/shared.config";

const appConfigSchema = z.object({
  app: z.object({ port: z.coerce.number().int().positive().default(3000) }),
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
    database: {
      host: process.env.DATABASE_HOST,
      port: process.env.DATABASE_PORT,
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      name: process.env.DATABASE_NAME,
    },
  });
  if (result.success) return result.data;
  throw new ConfigException(
    `Invalid application configuration: ${result.error.message}`,
  );
};
