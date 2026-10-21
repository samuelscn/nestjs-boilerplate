import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { createOpenApiDocument } from "./openapi";
import { ApplicationConfig } from "./config";
import { ConfigService } from "./package/shared/module/config";
import { AppLogger, LoggingInterceptor } from "./package/shared/module/logger";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(app.get(LoggingInterceptor));

  const config = app.get(ConfigService<ApplicationConfig>);
  if (config.get("env") !== "production")
    SwaggerModule.setup("docs", app, () => createOpenApiDocument(app));
  const port = config.get("app.port");
  const appLogger = app.get(AppLogger);
  await app.listen(port);
  appLogger.log("Application started", {
    context: "Bootstrap",
    action: "APP_STARTED",
    port,
    environment: process.env.NODE_ENV ?? "development",
  });
}

void bootstrap();
