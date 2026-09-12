import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import type { Response } from "express";
import { AccessError } from "src/package/shared/module/authorization";

@Catch(AccessError)
export class AccessErrorFilter implements ExceptionFilter {
  catch(error: AccessError, host: ArgumentsHost): void {
    const status = {
      forbidden: 403,
      invalid: 400,
      not_found: 404,
      conflict: 409,
    }[error.code];
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: error.code });
  }
}
