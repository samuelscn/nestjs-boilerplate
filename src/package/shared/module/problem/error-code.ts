import type { DomainErrorKind } from "./domain-error";

/**
 * Generic public codes, one per category. Packages declare their own specific
 * codes (e.g. `LAST_OWNER_REQUIRED`) next to the use case that raises them.
 * Published codes are a contract: add new ones, never rename or reuse.
 */
export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  AUTHORIZATION_FORBIDDEN: "AUTHORIZATION_FORBIDDEN",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  DOMAIN_RULE_VIOLATION: "DOMAIN_RULE_VIOLATION",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Field-level codes used in `errors[]`. Mirrors class-validator constraint names. */
export const FieldErrorCode = {
  IS_NOT_EMPTY: "IS_NOT_EMPTY",
  IS_EMAIL: "IS_EMAIL",
  IS_UUID: "IS_UUID",
  MIN_LENGTH: "MIN_LENGTH",
  MAX_LENGTH: "MAX_LENGTH",
  UNKNOWN_FIELD: "UNKNOWN_FIELD",
  INVALID_VALUE: "INVALID_VALUE",
} as const;

export const kindStatus: Record<DomainErrorKind, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rule: 422,
  rate_limit: 429,
  unavailable: 503,
};

export const statusCode: Record<number, ErrorCode> = {
  400: ErrorCode.VALIDATION_ERROR,
  401: ErrorCode.AUTHENTICATION_REQUIRED,
  403: ErrorCode.AUTHORIZATION_FORBIDDEN,
  404: ErrorCode.RESOURCE_NOT_FOUND,
  405: ErrorCode.METHOD_NOT_ALLOWED,
  409: ErrorCode.RESOURCE_CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  422: ErrorCode.DOMAIN_RULE_VIOLATION,
  429: ErrorCode.RATE_LIMIT_EXCEEDED,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  500: ErrorCode.INTERNAL_SERVER_ERROR,
};

export const codeForStatus = (status: number): ErrorCode =>
  statusCode[status] ??
  (status >= 500
    ? ErrorCode.INTERNAL_SERVER_ERROR
    : ErrorCode.VALIDATION_ERROR);
