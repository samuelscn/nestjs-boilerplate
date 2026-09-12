import { Injectable } from "@nestjs/common";
import { isPermission, Permission } from "./permissions";
import { AccessError, RequestContext } from "./request-context";

export interface PermissionRequirement {
  readonly mode: "all" | "any";
  readonly permissions: readonly Permission[];
}

@Injectable()
export class AuthorizationService {
  can(context: RequestContext | undefined, permission: Permission): boolean {
    return (
      !!context?.identity.userId &&
      isPermission(permission) &&
      context.authorization.permissions.includes(permission)
    );
  }
  hasPermission(
    context: RequestContext | undefined,
    permission: Permission,
  ): boolean {
    return this.can(context, permission);
  }
  hasAnyPermission(
    context: RequestContext | undefined,
    ...permissions: Permission[]
  ): boolean {
    return (
      permissions.length > 0 &&
      permissions.every(isPermission) &&
      permissions.some((permission) => this.can(context, permission))
    );
  }
  hasAllPermissions(
    context: RequestContext | undefined,
    ...permissions: Permission[]
  ): boolean {
    return (
      permissions.length > 0 &&
      permissions.every((permission) => this.can(context, permission))
    );
  }
  allows(
    context: RequestContext | undefined,
    requirement: PermissionRequirement | undefined,
  ): boolean {
    if (!requirement) return false;
    return requirement.mode === "all"
      ? this.hasAllPermissions(context, ...requirement.permissions)
      : requirement.mode === "any" &&
          this.hasAnyPermission(context, ...requirement.permissions);
  }
  require(context: RequestContext, permission: Permission): void {
    if (!this.can(context, permission)) throw new AccessError("forbidden");
  }
}
