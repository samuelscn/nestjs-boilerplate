import { DynamicModule, Global, Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";
import { AppLogger } from "./service/app-logger.service";
import { LoggingInterceptor } from "./interceptor/logging.interceptor";

type NestPinoLoggerModule = {
  forRoot(options: {
    pinoHttp?: {
      level?: string;
      serializers?: Record<string, (value: Record<string, unknown>) => unknown>;
      transport?: unknown;
      formatters?: {
        level?: (label: unknown) => { level: unknown };
      };
      redact?: {
        paths: string[];
        censor: string;
      };
    };
  }): DynamicModule;
};

const TypedPinoLoggerModule =
  PinoLoggerModule as unknown as NestPinoLoggerModule;

@Global()
@Module({
  imports: [
    TypedPinoLoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || "info",
        serializers: {
          // Never serialize request headers, bodies or query parameters, even on 401.
          req: (request) => ({
            id: request.id,
            method: request.method,
            url:
              typeof request.url === "string"
                ? request.url.split("?")[0]
                : undefined,
          }),
        },
        redact: {
          paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.token",
            'res.headers["set-cookie"]',
          ],
          censor: "[REDACTED]",
        },
        transport:
          process.env.NODE_ENV !== "production"
            ? {
                target: "pino-pretty",
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
                },
              }
            : undefined,
        // Em produção, usar formato JSON estruturado
        formatters: {
          level: (label) => ({ level: label }),
        },
      },
    }),
  ],
  providers: [AppLogger, LoggingInterceptor],
  exports: [AppLogger, LoggingInterceptor],
})
export class LoggerModule {}
