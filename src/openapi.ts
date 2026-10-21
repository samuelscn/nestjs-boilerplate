import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from "@nestjs/swagger";
import { AccessProblem } from "./package/access-control/core/model/access.model";
import { PERMISSIONS } from "./package/shared/module/authorization";
import {
  ErrorCode,
  FieldErrorCode,
  kindStatus,
} from "./package/shared/module/problem";

/**
 * Public problem codes clients must translate. Every package that declares
 * specific codes adds its catalog here; the frontend checks translations against it.
 */
const PROBLEM_CODES = [
  ...Object.values(ErrorCode),
  ...Object.values(AccessProblem),
];

type Schema = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const problemSchemas: Record<string, Schema> = {
  ProblemCode: {
    type: "string",
    description:
      "Stable problem identity. Clients decide and translate by this value; unknown values fall back to the generic message of the status.",
    enum: PROBLEM_CODES,
  },
  FieldProblemCode: {
    type: "string",
    description:
      "Validation code derived from the class-validator constraint (isEmail → IS_EMAIL). Listed values are the documented ones; others may appear.",
    enum: Object.values(FieldErrorCode),
  },
  ProblemParams: {
    type: "object",
    additionalProperties: {
      oneOf: [{ type: "string" }, { type: "number" }, { type: "boolean" }],
    },
  },
  FieldProblem: {
    type: "object",
    required: ["code"],
    properties: {
      field: { type: "string", example: "items[0].name" },
      code: { type: "string", example: "IS_NOT_EMPTY" },
      params: ref("ProblemParams"),
    },
  },
  ProblemDetails: {
    type: "object",
    description:
      "RFC 9457 Problem Details with Ginga extensions (code, params, errors, traceId, timestamp).",
    required: ["type", "title", "status", "code", "traceId", "timestamp"],
    properties: {
      type: { type: "string", format: "uri" },
      title: { type: "string" },
      status: { type: "integer", minimum: 400, maximum: 599 },
      detail: {
        type: "string",
        description: "Developer-facing; never shown to users.",
      },
      instance: { type: "string" },
      code: { type: "string", description: "See ProblemCode." },
      params: ref("ProblemParams"),
      errors: { type: "array", items: ref("FieldProblem") },
      traceId: {
        type: "string",
        description: "Equals the x-correlation-id header.",
      },
      timestamp: { type: "string", format: "date-time" },
    },
  },
  Permission: { type: "string", enum: [...PERMISSIONS] },
};

const ERROR_STATUSES = [...new Set(Object.values(kindStatus)), 500].sort();

/** Every operation documents the shared problem responses. */
function withProblemResponses(document: OpenAPIObject): OpenAPIObject {
  const problem = {
    content: { "application/problem+json": { schema: ref("ProblemDetails") } },
  };
  for (const path of Object.values(document.paths))
    for (const operation of Object.values(path)) {
      if (
        !operation ||
        typeof operation !== "object" ||
        !("responses" in operation)
      )
        continue;
      const responses = operation.responses as Record<string, unknown>;
      for (const status of ERROR_STATUSES)
        responses[String(status)] ??= {
          description: "Problem Details (RFC 9457)",
          ...problem,
        };
    }
  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ...problemSchemas },
  };
  return document;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Ginga Product API")
    .setVersion(process.env.npm_package_version ?? "1.0.0")
    .addBearerAuth()
    .addSecurityRequirements("bearer")
    .build();
  return withProblemResponses(SwaggerModule.createDocument(app, config));
}
