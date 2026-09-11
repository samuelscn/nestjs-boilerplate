import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { AppLogger } from "../service/app-logger.service";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, originalUrl, body, query, params } = request;
    const userAgent = request.get("user-agent") || "";
    const receivedCorrelationId = request.headers["x-correlation-id"];
    const correlationId = Array.isArray(receivedCorrelationId)
      ? receivedCorrelationId[0]
      : (receivedCorrelationId ?? randomUUID());
    response.setHeader("x-correlation-id", correlationId);

    const startTime = Date.now();
    const logContext = "HTTP";

    // Log da requisição de entrada
    this.logger.log(`[REQUEST] ${method} ${originalUrl}`, {
      context: logContext,
      action: "HTTP_REQUEST",
      correlationId,
      method,
      url: originalUrl,
      query: this.sanitize(query),
      params: this.sanitize(params),
      body: this.sanitize(body),
      userAgent,
    });

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.logger.log(
            `[RESPONSE] ${method} ${originalUrl} ${statusCode} - ${duration}ms`,
            {
              context: logContext,
              action: "HTTP_RESPONSE",
              correlationId,
              method,
              url: originalUrl,
              statusCode,
              duration,
              responseSize: this.getResponseSize(data),
            },
          );
        },
        error: (error: unknown) => {
          const duration = Date.now() - startTime;
          // O erro será logado pelo GlobalExceptionFilter
          // Aqui apenas registramos a métrica de tempo
          this.logger.debug(
            `[RESPONSE_ERROR] ${method} ${originalUrl} - ${duration}ms`,
            {
              context: logContext,
              action: "HTTP_RESPONSE_ERROR",
              correlationId,
              method,
              url: originalUrl,
              duration,
              errorName: error instanceof Error ? error.name : "UnknownError",
            },
          );
        },
      }),
    );
  }

  private sanitize(obj: unknown): unknown {
    if (!obj || typeof obj !== "object") return obj;

    if (Array.isArray(obj)) return obj.map((value) => this.sanitize(value));

    const sensitiveKeys = new Set([
      "password",
      "senha",
      "token",
      "authorization",
      "auth",
      "jwt",
      "access_token",
      "refresh_token",
      "cpf",
      "cnpj",
    ]);

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.has(lowerKey)) {
        result[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        result[key] = this.sanitize(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private getResponseSize(data: unknown): number | undefined {
    try {
      return Buffer.byteLength(JSON.stringify(data) ?? "");
    } catch {
      return undefined;
    }
  }
}
