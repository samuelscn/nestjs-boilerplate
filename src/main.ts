import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { ApplicationConfig } from "./config";
import { ConfigService } from "./package/shared/module/config";
import { AppLogger, LoggingInterceptor } from "./package/shared/module/logger";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(app.get(LoggingInterceptor));

  const port = app.get(ConfigService<ApplicationConfig>).get("app.port");
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
