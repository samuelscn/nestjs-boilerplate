import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

export const CORRELATION_HEADER = "x-correlation-id";

/**
 * Single correlation id per request, shared by logs and error responses.
 * Guards run before interceptors, so whichever component asks first assigns it
 * to the response; every later caller reads the same value back.
 */
export function correlationIdOf(request: Request, response: Response): string {
  const assigned = response.getHeader(CORRELATION_HEADER);
  if (typeof assigned === "string") return assigned;
  const received = request.headers[CORRELATION_HEADER];
  const id =
    typeof received === "string" && /^[a-f0-9-]{36}$/i.test(received)
      ? received
      : randomUUID();
  if (!response.headersSent) response.setHeader(CORRELATION_HEADER, id);
  return id;
}
