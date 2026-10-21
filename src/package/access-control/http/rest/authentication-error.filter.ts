import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

@Catch(UnauthorizedException)
export class AuthenticationErrorFilter implements ExceptionFilter {
  catch(_error: UnauthorizedException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = randomUUID();
    response.setHeader("x-request-id", requestId);
    response.setHeader("WWW-Authenticate", "Bearer");
    response.status(401).json({
      statusCode: 401,
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required.",
      requestId,
      timestamp: new Date().toISOString(),
      path: request.path,
    });
  }
}
