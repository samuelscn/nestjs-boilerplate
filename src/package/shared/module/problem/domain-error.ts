/** Primitive values only: they feed ICU messages on clients and must never carry secrets or PII. */
export type ProblemParams = Readonly<Record<string, string | number | boolean>>;

export interface FieldProblem {
  /** Dotted path of the input field, e.g. `address.zipCode` or `items[0].name`. */
  readonly field?: string;
  readonly code: string;
  readonly params?: ProblemParams;
}

/**
 * Semantic category of a failure. Core code chooses the category; the HTTP layer
 * owns the status mapping, so services never import HTTP concepts.
 */
export type DomainErrorKind =
  | "validation"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rule"
  | "rate_limit"
  | "unavailable";

/**
 * Expected failure of a use case. `code` is the stable public identity of the
 * problem (UPPER_SNAKE_CASE, never renamed once published); clients translate it.
 */
export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  readonly code: string;
  readonly params?: ProblemParams;
  readonly errors?: readonly FieldProblem[];
  /** Developer-facing explanation in English. Never shown to end users by clients. */
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    kind: DomainErrorKind,
    code: string,
    options: {
      params?: ProblemParams;
      errors?: readonly FieldProblem[];
      detail?: string;
      retryAfterSeconds?: number;
      cause?: unknown;
    } = {},
  ) {
    super(code, { cause: options.cause });
    if (!/^[A-Z][A-Z0-9_]{0,95}$/.test(code))
      throw new Error(`Invalid problem code: ${code}`);
    this.name = "DomainError";
    this.kind = kind;
    this.code = code;
    this.params = options.params;
    this.errors = options.errors;
    this.detail = options.detail;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
