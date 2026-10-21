import { SetMetadata } from "@nestjs/common";
import type {
  Permission,
  PermissionRequirement,
} from "src/package/shared/module/authorization";

export const PERMISSION_REQUIREMENT = Symbol("permission-requirement");
export const IDENTITY_ONLY = Symbol("identity-only");
export const MEMBERSHIP_ONLY = Symbol("membership-only");
export const RequireAllPermissions = (
  ...permissions: [Permission, ...Permission[]]
) =>
  SetMetadata(
    PERMISSION_REQUIREMENT,
    Object.freeze({
      mode: "all",
      permissions: Object.freeze(permissions),
    }) satisfies PermissionRequirement,
  );
export const RequireAnyPermission = (
  ...permissions: [Permission, ...Permission[]]
) =>
  SetMetadata(
    PERMISSION_REQUIREMENT,
    Object.freeze({
      mode: "any",
      permissions: Object.freeze(permissions),
    }) satisfies PermissionRequirement,
  );
export const RequirePermission = (permission: Permission) =>
  RequireAllPermissions(permission);

/**
 * Any member of the current scope, regardless of permissions. For self-service
 * reads such as "my access"; never for data about other users.
 */
export const RequireMembership = () => SetMetadata(MEMBERSHIP_ONLY, true);

/** Explicit exception for authenticated tenant signup, not a public-route decorator. */
export const AuthenticatedTenantSignup = () => SetMetadata(IDENTITY_ONLY, true);
