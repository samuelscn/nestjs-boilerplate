import type { Request } from "express";
import type { IdentityCredentials } from "../../core/contract/identity-provider";

const MAX_ACCESS_TOKEN_LENGTH = 4096;

/** HTTP-only credential extraction. Identity providers never receive Request. */
export function bearerIdentityCredentials(
  request: Request,
): IdentityCredentials | null {
  const occurrences = request.rawHeaders.filter(
    (_, index) =>
      index % 2 === 0 &&
      request.rawHeaders[index].toLowerCase() === "authorization",
  ).length;
  const header = request.headers.authorization;
  if (occurrences !== 1 || typeof header !== "string") return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  if (!match || match[1].length > MAX_ACCESS_TOKEN_LENGTH) return null;
  return Object.freeze({ type: "bearer", accessToken: match[1] });
}
