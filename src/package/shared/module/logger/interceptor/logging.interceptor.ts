import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { correlationIdOf } from "../correlation";
import { AppLogger } from "../service/app-logger.service";

// Normalize spelling variants such as accessToken, access_token and Access-Token.
const SENSITIVE_KEYS = new Set([
  "password",
  "senha",
  "token",
  "authorization",
  "auth",
  "jwt",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "clientsecret",
  "secret",
  "cookie",
  "setcookie",
  "sessioncookie",
  "sessiontoken",
  "apikey",
  "identityuserid",
  "userid",
  "cpf",
  "cnpj",
  "email",
  "phone",
  "telefone",
]);

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

    const { method, path: originalUrl, body, query, params } = request;
    const correlationId = correlationIdOf(request, response);

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
      userAgent: this.sanitize(request.get("user-agent") || ""),
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
          // O erro é registrado pelo ProblemExceptionFilter
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

  private sanitize(value: unknown): unknown {
    if (typeof value === "string") {
      // Defense in depth for compact JWTs embedded under an unexpected field name.
      return value.replace(
        /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
        "[REDACTED]",
      );
    }
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item));

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase().replace(/[_-]/g, ""))
          ? "[REDACTED]"
          : this.sanitize(item),
      ]),
    );
  }

  private getResponseSize(data: unknown): number | undefined {
    try {
      return Buffer.byteLength(JSON.stringify(data) ?? "");
    } catch {
      return undefined;
    }
  }
}
