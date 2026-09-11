import { ConfigException } from "./config.exception";
import { z } from "zod";

export const environmentSchema = z.enum(["test", "development", "production"]);

export const sharedConfigSchema = z.object({
  env: environmentSchema.default("development"),
  logRules: z.string().default("context=*;level=info"),
});

export type Environment = z.infer<typeof environmentSchema>;

export type SharedConfig = z.infer<typeof sharedConfigSchema>;

export const sharedConfigFactory = (): SharedConfig => {
  const result = sharedConfigSchema.safeParse({
    env: process.env.NODE_ENV,
    logRules: process.env.LOG_RULES,
  });

  if (result.success) {
    return result.data;
  }

  throw new ConfigException(
    `Invalid application configuration: ${result.error.message}`,
  );
};
