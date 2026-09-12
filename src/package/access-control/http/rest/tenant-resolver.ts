import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { TENANT_ID_PATTERN } from "src/package/shared/module/tenant-database";

/** Resolves only the requested tenant, never proves membership. */
export abstract class TenantResolver {
  abstract resolve(request: Request): string;
}

@Injectable()
export class HeaderTenantResolver extends TenantResolver {
  resolve(request: Request): string {
    const value = request.headers["x-tenant-id"];
    const occurrences = request.rawHeaders
      .filter((_, index) => index % 2 === 0)
      .filter((header) => header.toLowerCase() === "x-tenant-id").length;
    if (
      occurrences !== 1 ||
      typeof value !== "string" ||
      !TENANT_ID_PATTERN.test(value)
    )
      throw new ForbiddenException();
    return value.toLowerCase();
  }
}
