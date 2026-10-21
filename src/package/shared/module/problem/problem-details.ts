import type { FieldProblem, ProblemParams } from "./domain-error";

export const PROBLEM_CONTENT_TYPE = "application/problem+json; charset=utf-8";
export const DEFAULT_PROBLEM_TYPE_BASE = "urn:ginga:problem:";

/**
 * RFC 9457 Problem Details plus Ginga extensions (`code`, `params`, `errors`,
 * `traceId`, `timestamp`). `title`/`detail` are developer-facing English text;
 * clients decide by `code` and translate it, never by text.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code: string;
  params?: ProblemParams;
  errors?: FieldProblem[];
  traceId: string;
  timestamp: string;
}

/** `RESOURCE_CONFLICT` → `Resource Conflict`. */
export const problemTitle = (code: string): string =>
  code
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** `RESOURCE_CONFLICT` → `<base>resource-conflict`. Stable as long as the code is. */
export const problemType = (base: string, code: string): string =>
  base + code.toLowerCase().replaceAll("_", "-");
