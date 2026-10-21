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
export const MEMBER_STATUSES = ["invited", "active", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];
export interface Member {
  id: string;
  /** Null while an invitation is pending. */
  identityUserId: string | null;
  email: string | null;
  displayName: string | null;
  status: MemberStatus;
  lastSeenAt: Date | null;
  /** Internal: when the display profile was last refreshed from the identity provider. */
  profileSyncedAt?: Date | null;
  roleIds: string[];
}
export interface MemberQuery {
  /** Case-insensitive match on display name or email. */
  q: string;
  roleIds: readonly string[];
  statuses: readonly MemberStatus[];
  page: number;
  pageSize: number;
}
export interface MemberPage {
  items: Member[];
  total: number;
  page: number;
  pageSize: number;
}
/** Display data from the identity provider; never used for authorization. */
export interface IdentityProfile {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
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
  | "membership.invited"
  | "membership.claimed"
  | "membership.suspended"
  | "membership.reactivated"
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
  /** A member with the same identity or email already exists. */
  MEMBER_ALREADY_EXISTS: "MEMBER_ALREADY_EXISTS",
  /** A pending invitation becomes active only when the invitee signs in. */
  INVITATION_PENDING: "INVITATION_PENDING",
  /** Members cannot suspend themselves. */
  SELF_MANAGEMENT_FORBIDDEN: "SELF_MANAGEMENT_FORBIDDEN",
} as const;
