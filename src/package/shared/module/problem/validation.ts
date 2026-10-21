import { ValidationError, ValidationPipe } from "@nestjs/common";
import { DomainError, FieldProblem, ProblemParams } from "./domain-error";
import { ErrorCode, FieldErrorCode } from "./error-code";

const MAX_FIELD_ERRORS = 100;

/** `isNotEmpty` → `IS_NOT_EMPTY`; `whitelistValidation` (unknown property) → `UNKNOWN_FIELD`. */
export const constraintCode = (constraint: string): string =>
  constraint === "whitelistValidation"
    ? FieldErrorCode.UNKNOWN_FIELD
    : constraint
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^A-Za-z0-9_]/g, "_")
        .toUpperCase()
        .slice(0, 96) || FieldErrorCode.INVALID_VALUE;

const joinPath = (parent: string, property: string): string =>
  !parent
    ? property
    : /^\d+$/.test(property)
      ? `${parent}[${property}]`
      : `${parent}.${property}`;

/**
 * Flattens class-validator output into `errors[]`. Decorators may expose ICU
 * params through `context`, e.g. `@Min(18, { context: { params: { min: 18 } } })`.
 */
export function fieldProblems(
  errors: ValidationError[],
  parent = "",
): FieldProblem[] {
  return errors.flatMap((error) => {
    const field = joinPath(parent, error.property);
    const own = Object.keys(error.constraints ?? {}).map((constraint) => {
      const context = error.contexts?.[constraint] as
        | { params?: ProblemParams }
        | undefined;
      return {
        field,
        code: constraintCode(constraint),
        ...(context?.params ? { params: context.params } : {}),
      };
    });
    return [...own, ...fieldProblems(error.children ?? [], field)];
  });
}

export const validationException = (errors: ValidationError[]) =>
  new DomainError("validation", ErrorCode.VALIDATION_ERROR, {
    errors: fieldProblems(errors).slice(0, MAX_FIELD_ERRORS),
  });

/** The application's only validation pipe; keeps DTO failures inside the problem contract. */
export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationException,
  });
