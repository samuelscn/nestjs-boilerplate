import {
  PERMISSIONS,
  Permission,
} from "src/package/shared/module/authorization";

export type AccessMode = "single" | "tenant";
export interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}
export interface Member {
  id: string;
  identityUserId: string;
  roleIds: string[];
}
export interface RoleInput {
  name: string;
  slug: string;
  description?: string;
  permissions: readonly string[];
}
export interface TenantInput {
  name: string;
  slug: string;
}
export const SYSTEM_ROLES = Object.freeze([
  { name: "OWNER", slug: "owner", permissions: PERMISSIONS },
  // Administrative access is explicit; ownership is a protected assignment.
  { name: "ADMIN", slug: "admin", permissions: PERMISSIONS },
  { name: "MEMBER", slug: "member", permissions: [Permission.example.read] },
]);
export type AuditEvent =
  | "tenant.created"
  | "membership.created"
  | "membership.removed"
  | "role.created"
  | "role.updated"
  | "role.deleted"
  | "role.assigned"
  | "role.unassigned"
  | "role.permissions.updated";

/** Public problem codes specific to access control. Published codes are never renamed. */
export const AccessProblem = {
  /** System roles (e.g. owner) cannot be edited or deleted. */
  SYSTEM_ROLE_IMMUTABLE: "SYSTEM_ROLE_IMMUTABLE",
  /** The operation would leave the scope without an owner. */
  LAST_OWNER_REQUIRED: "LAST_OWNER_REQUIRED",
} as const;
