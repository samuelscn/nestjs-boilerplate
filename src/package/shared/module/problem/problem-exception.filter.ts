import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Inject,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { AccessError } from "../authorization";
import { correlationIdOf } from "../logger/correlation";
import { DomainError, DomainErrorKind } from "./domain-error";
import { codeForStatus, ErrorCode, kindStatus } from "./error-code";
import {
  PROBLEM_CONTENT_TYPE,
  ProblemDetails,
  problemTitle,
  problemType,
} from "./problem-details";

export const PROBLEM_OPTIONS = Symbol("problem-options");
export interface ProblemOptions {
  /** Prefix of every `type` URI, e.g. `https://api.example.com/problems/`. */
  typeBase: string;
}

const accessKind: Record<AccessError["code"], DomainErrorKind> = {
  forbidden: "forbidden",
  invalid: "validation",
  not_found: "not_found",
  conflict: "conflict",
};

type Resolved = Pick<ProblemDetails, "status" | "code"> &
  Partial<Pick<ProblemDetails, "detail" | "params" | "errors">> & {
    retryAfterSeconds?: number;
  };

/**
 * Converts every failure into RFC 9457 Problem Details. Unknown errors become a
 * generic 500: stack, SQL and messages stay in the log, tied to `traceId`.
 */
@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ProblemExceptionFilter");
  constructor(
    @Inject(PROBLEM_OPTIONS) private readonly options: ProblemOptions,
  ) {}

  catch(error: unknown, host: ArgumentsHost): void {
    if (host.getType() !== "http") throw error;
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (response.headersSent) return;
    const traceId = correlationIdOf(request, response);
    const resolved = this.resolve(error);
    if (resolved.status >= 500)
      this.logger.error(
        { traceId, path: request.path, errorName: (error as Error)?.name },
        error instanceof Error ? error.stack : undefined,
      );
    const body: ProblemDetails = {
      type: problemType(this.options.typeBase, resolved.code),
      title: problemTitle(resolved.code),
      status: resolved.status,
      ...(resolved.detail && resolved.status < 500
        ? { detail: resolved.detail }
        : {}),
      instance: request.path,
      code: resolved.code,
      ...(resolved.params && resolved.status < 500
        ? { params: resolved.params }
        : {}),
      ...(resolved.errors?.length ? { errors: resolved.errors } : {}),
      traceId,
      timestamp: new Date().toISOString(),
    };
    if (resolved.status === 401)
      response.setHeader("WWW-Authenticate", "Bearer");
    if (resolved.retryAfterSeconds !== undefined)
      response.setHeader("Retry-After", String(resolved.retryAfterSeconds));
    response
      .status(resolved.status)
      .setHeader("Content-Type", PROBLEM_CONTENT_TYPE)
      .send(JSON.stringify(body));
  }

  private resolve(error: unknown): Resolved {
    if (error instanceof DomainError)
      return {
        status: kindStatus[error.kind],
        code: error.code,
        detail: error.detail,
        params: error.params,
        errors: error.errors ? [...error.errors] : undefined,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    if (error instanceof AccessError) {
      const status = kindStatus[accessKind[error.code]];
      return { status, code: error.problemCode ?? codeForStatus(status) };
    }
    const status =
      error instanceof HttpException
        ? error.getStatus()
        : // body-parser and other Express middleware errors expose a status.
          numericStatus(error);
    if (status >= 400 && status < 500)
      return { status, code: codeForStatus(status) };
    return {
      status: status === 503 ? 503 : 500,
      code:
        status === 503
          ? ErrorCode.SERVICE_UNAVAILABLE
          : ErrorCode.INTERNAL_SERVER_ERROR,
    };
  }
}

function numericStatus(error: unknown): number {
  if (!error || typeof error !== "object") return 500;
  const { status, statusCode } = error as {
    status?: unknown;
    statusCode?: unknown;
  };
  const value = typeof status === "number" ? status : statusCode;
  return typeof value === "number" && value >= 400 && value <= 599
    ? value
    : 500;
}
