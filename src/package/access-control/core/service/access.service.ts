import { Injectable, Optional } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  AccessError,
  AuthorizationService,
  Identity,
  isPermission,
  Permission,
  PermissionRequirement,
  RequestContext,
  RequestContexts,
} from "src/package/shared/module/authorization";
import { DomainError } from "src/package/shared/module/problem";
import { AccessStore } from "../contract/access-store";
import {
  IdentityCredentials,
  IdentityProvider,
} from "../contract/identity-provider";
import {
  Member,
  MemberPage,
  MemberQuery,
  MEMBER_STATUSES,
  Role,
  RoleInput,
  AccessProblem,
  SYSTEM_ROLES,
  TenantInput,
} from "../model/access.model";

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const LAST_SEEN_RESOLUTION_MS = 5 * 60 * 1000;

@Injectable()
export class AccessService {
  constructor(
    private readonly store: AccessStore,
    private readonly authorization: AuthorizationService,
    private readonly contexts: RequestContexts,
    @Optional() private readonly identities?: IdentityProvider,
  ) {}

  get mode() {
    return this.store.mode;
  }

  async resolve(identity: Identity, scope?: string): Promise<RequestContext> {
    this.validateScope(scope);
    return this.store.transaction(scope, async () => {
      const context = await this.store.loadContext(identity);
      if (!context) throw new AccessError("forbidden");
      return context;
    });
  }

  /** Recheck under the same lock/transaction used by the business operation. */
  async runAuthorized<T>(
    identity: Identity,
    scope: string | undefined,
    requirements: readonly PermissionRequirement[],
    work: () => Promise<T>,
  ): Promise<T> {
    this.validateScope(scope);
    return this.store.transaction(scope, async () => {
      await this.store.lockScope();
      const context = await this.store.loadContext(identity);
      if (
        !context ||
        !requirements.length ||
        !requirements.every((rule) => this.authorization.allows(context, rule))
      )
        throw new AccessError("forbidden");
      return this.contexts.run(context, work);
    });
  }

  /** Same transaction/lock as runAuthorized, for membership-only operations. */
  async runAsMember<T>(
    identity: Identity,
    scope: string | undefined,
    work: () => Promise<T>,
  ): Promise<T> {
    this.validateScope(scope);
    return this.store.transaction(scope, async () => {
      const context = await this.store.loadContext(identity);
      if (!context) throw new AccessError("forbidden");
      return this.contexts.run(context, work);
    });
  }

  /**
   * Effective access of the caller: what the UI may offer (the API still authorizes
   * every call). Also refreshes the caller's display profile when stale and, in
   * single mode, binds a pending invitation whose email the identity verified.
   */
  async myAccess(credentials?: IdentityCredentials): Promise<{
    userId: string;
    roleIds: readonly string[];
    permissions: readonly Permission[];
  }> {
    const { identity } = this.contexts.current();
    let context = this.contexts.current();
    const now = new Date();
    let member = await this.store.findMemberByIdentity(identity.userId);
    const stale =
      !member?.profileSyncedAt ||
      now.getTime() - member.profileSyncedAt.getTime() > PROFILE_TTL_MS;
    const profile =
      stale && credentials && this.identities
        ? await this.identities.profile(credentials)
        : null;
    if (
      !member &&
      this.mode === "single" &&
      profile?.email &&
      profile.emailVerified &&
      (await this.store.claimInvitation(identity.userId, profile.email))
    ) {
      member = await this.store.findMemberByIdentity(identity.userId);
      await this.store.audit("membership.claimed", identity.userId, member.id);
      context = (await this.store.loadContext(identity)) ?? context;
    }
    if (member) {
      const seen =
        !member.lastSeenAt ||
        now.getTime() - member.lastSeenAt.getTime() > LAST_SEEN_RESOLUTION_MS;
      if (profile || seen)
        await this.store.updateProfile(member.id, {
          ...(seen ? { lastSeenAt: now } : {}),
          ...(profile
            ? {
                displayName: profile.displayName,
                // Only a verified email replaces the one the invitation used.
                ...(profile.emailVerified && profile.email
                  ? { email: profile.email }
                  : {}),
                profileSyncedAt: now,
              }
            : {}),
        });
    }
    return {
      userId: identity.userId,
      roleIds: context.authorization.roleIds,
      permissions: context.authorization.permissions,
    };
  }

  listMembersPage(query: MemberQuery): Promise<MemberPage> {
    return this.execute(Permission.member.read, () => {
      if (
        query.q.length > 120 ||
        query.page < 1 ||
        query.pageSize < 1 ||
        query.pageSize > 100 ||
        query.roleIds.length > 50 ||
        !query.statuses.every((status) => MEMBER_STATUSES.includes(status))
      )
        throw new AccessError("invalid");
      return this.store.listMembersPage(query);
    });
  }

  /** Single mode: the invitee becomes active on first sign-in with this verified email. */
  inviteMember(email: string, roleId: string): Promise<Member> {
    return this.execute(Permission.member.invite, async (context) => {
      if (this.mode !== "single") throw new AccessError("forbidden");
      const normalized =
        typeof email === "string" ? email.trim().toLowerCase() : "";
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ||
        normalized.length > 254
      )
        throw new AccessError("invalid");
      this.authorization.require(context, Permission.role.assign);
      const role = await this.requireRole(roleId);
      this.manageable(role, context);
      if (
        role.slug === "owner" &&
        !context.authorization.roleIds.includes(role.id)
      )
        throw new AccessError("forbidden");
      const member = await this.store.inviteMember(normalized);
      await this.store.assignRole(member.id, role.id);
      await this.store.audit(
        "membership.invited",
        context.identity.userId,
        member.id,
      );
      return { ...member, roleIds: [role.id] };
    });
  }

  setMemberStatus(id: string, status: "active" | "suspended"): Promise<Member> {
    return this.execute(Permission.member.update, async (context) => {
      if (status !== "active" && status !== "suspended")
        throw new AccessError("invalid");
      const member = await this.requireMember(id);
      if (member.identityUserId === context.identity.userId)
        throw new DomainError("rule", AccessProblem.SELF_MANAGEMENT_FORBIDDEN);
      if (member.status === "invited")
        throw new DomainError("rule", AccessProblem.INVITATION_PENDING);
      if (member.status === status) return member;
      const roles = await this.store.listRoles();
      for (const role of roles.filter((role) =>
        member.roleIds.includes(role.id),
      )) {
        this.manageable(role, context);
        if (role.slug === "owner") {
          if (!context.authorization.roleIds.includes(role.id))
            throw new AccessError("forbidden");
          if (status === "suspended" && (await this.store.countOwners()) <= 1)
            throw new AccessError(
              "conflict",
              AccessProblem.LAST_OWNER_REQUIRED,
            );
        }
      }
      await this.store.updateMemberStatus(id, status);
      await this.store.audit(
        status === "suspended"
          ? "membership.suspended"
          : "membership.reactivated",
        context.identity.userId,
        id,
      );
      return { ...member, status };
    });
  }

  private validateScope(scope?: string): void {
    if ((this.mode === "tenant") !== !!scope)
      throw new AccessError("forbidden");
  }

  private execute<T>(
    permission: Permission,
    work: (context: RequestContext) => Promise<T>,
  ): Promise<T> {
    const current = this.contexts.current();
    return this.runAuthorized(
      current.identity,
      current.tenant?.id,
      [{ mode: "all", permissions: [permission] }],
      () => work(this.contexts.current()),
    );
  }

  listRoles(): Promise<Role[]> {
    return this.execute(Permission.role.read, () => this.store.listRoles());
  }
  listMembers(): Promise<Member[]> {
    return this.execute(Permission.member.read, () => this.store.listMembers());
  }

  createRole(input: RoleInput): Promise<Role> {
    return this.execute(Permission.role.create, async (context) => {
      this.validateRole(input, context);
      const role = await this.store.saveRole(input);
      await this.store.audit("role.created", context.identity.userId, role.id);
      await this.store.audit(
        "role.permissions.updated",
        context.identity.userId,
        role.id,
      );
      return role;
    });
  }

  updateRole(id: string, input: RoleInput): Promise<Role> {
    return this.execute(Permission.role.update, async (context) => {
      const role = await this.requireRole(id);
      this.manageable(role, context);
      if (role.isSystem)
        throw new AccessError("conflict", AccessProblem.SYSTEM_ROLE_IMMUTABLE);
      this.validateRole(input, context);
      const updated = await this.store.saveRole(input, false, id);
      await this.store.audit("role.updated", context.identity.userId, id);
      await this.store.audit(
        "role.permissions.updated",
        context.identity.userId,
        id,
      );
      return updated;
    });
  }

  deleteRole(id: string): Promise<void> {
    return this.execute(Permission.role.delete, async (context) => {
      const role = await this.requireRole(id);
      this.manageable(role, context);
      if (role.isSystem)
        throw new AccessError("conflict", AccessProblem.SYSTEM_ROLE_IMMUTABLE);
      await this.store.deleteRole(id);
      await this.store.audit("role.deleted", context.identity.userId, id);
    });
  }

  assignRole(memberId: string, roleId: string): Promise<void> {
    return this.changeAssignment(memberId, roleId, true);
  }
  unassignRole(memberId: string, roleId: string): Promise<void> {
    return this.changeAssignment(memberId, roleId, false);
  }
  private changeAssignment(
    memberId: string,
    roleId: string,
    assign: boolean,
  ): Promise<void> {
    return this.execute(Permission.role.assign, async (context) => {
      const member = await this.requireMember(memberId);
      const role = await this.requireRole(roleId);
      this.manageable(role, context);
      if (role.slug === "owner") {
        if (!context.authorization.roleIds.includes(role.id))
          throw new AccessError("forbidden");
        if (
          !assign &&
          member.roleIds.includes(roleId) &&
          (await this.store.countOwners()) <= 1
        )
          throw new AccessError("conflict", AccessProblem.LAST_OWNER_REQUIRED);
      }
      if (assign) await this.store.assignRole(memberId, roleId);
      else await this.store.unassignRole(memberId, roleId);
      await this.store.audit(
        assign ? "role.assigned" : "role.unassigned",
        context.identity.userId,
        `${memberId}/${roleId}`,
      );
    });
  }

  createMember(identityUserId: string): Promise<Member> {
    return this.execute(Permission.member.invite, async (context) => {
      this.validateIdentity(identityUserId);
      const member = await this.store.createMember(identityUserId);
      await this.store.audit(
        "membership.created",
        context.identity.userId,
        member.id,
      );
      return member;
    });
  }

  removeMember(id: string): Promise<void> {
    return this.execute(Permission.member.remove, async (context) => {
      const member = await this.requireMember(id);
      const roles = await this.store.listRoles();
      for (const role of roles.filter((role) =>
        member.roleIds.includes(role.id),
      )) {
        this.manageable(role, context);
        if (role.slug === "owner") {
          if (!context.authorization.roleIds.includes(role.id))
            throw new AccessError("forbidden");
          if ((await this.store.countOwners()) <= 1)
            throw new AccessError(
              "conflict",
              AccessProblem.LAST_OWNER_REQUIRED,
            );
        }
      }
      await this.store.deleteMember(id);
      await this.store.audit("membership.removed", context.identity.userId, id);
    });
  }

  /** Explicit authenticated signup policy; no current tenant is accepted. */
  async createTenant(input: TenantInput): Promise<{ id: string }> {
    const context = this.contexts.current();
    if (this.mode !== "tenant" || context.tenant)
      throw new AccessError("forbidden");
    this.validateIdentity(context.identity.userId);
    this.validateNameSlug(input);
    const id = randomUUID();
    return this.store.transaction(id, async () => {
      await this.store.createTenant(id, input);
      await this.bootstrapOwner(context.identity.userId);
      await this.store.audit("tenant.created", context.identity.userId, id);
      return { id };
    });
  }

  /** Deployment provisioning only. No HTTP endpoint; only an empty installation. */
  async initializeSingleApplication(
    ownerIdentityUserId: string,
  ): Promise<void> {
    if (this.mode !== "single") throw new AccessError("forbidden");
    this.validateIdentity(ownerIdentityUserId);
    await this.store.transaction(undefined, async () => {
      await this.store.lockScope();
      if (
        (await this.store.listRoles()).length ||
        (await this.store.listMembers()).length
      )
        throw new AccessError("conflict");
      await this.bootstrapOwner(ownerIdentityUserId);
    });
  }

  private async bootstrapOwner(identityUserId: string): Promise<void> {
    const member = await this.store.createMember(identityUserId);
    await this.store.audit("membership.created", identityUserId, member.id);
    for (const system of SYSTEM_ROLES) {
      const role = await this.store.saveRole(system, true);
      await this.store.audit("role.created", identityUserId, role.id);
      await this.store.audit(
        "role.permissions.updated",
        identityUserId,
        role.id,
      );
      if (system.slug === "owner") {
        await this.store.assignRole(member.id, role.id);
        await this.store.audit(
          "role.assigned",
          identityUserId,
          `${member.id}/${role.id}`,
        );
      }
    }
  }

  private manageable(role: Role, context: RequestContext): void {
    if (
      !role.permissions.every((permission) =>
        this.authorization.can(context, permission),
      )
    )
      throw new AccessError("forbidden");
  }
  private validateRole(input: RoleInput, context: RequestContext): void {
    this.validateNameSlug(input);
    if (
      SYSTEM_ROLES.some((role) => role.slug === input.slug) ||
      (input.description?.length ?? 0) > 500 ||
      !Array.isArray(input.permissions) ||
      !input.permissions.length ||
      input.permissions.length > 1000 ||
      !input.permissions.every(isPermission)
    )
      throw new AccessError("invalid");
    if (
      !input.permissions.every((permission) =>
        this.authorization.can(context, permission),
      )
    )
      throw new AccessError("forbidden");
  }
  private validateNameSlug(input: TenantInput): void {
    if (
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > 120 ||
      typeof input.slug !== "string" ||
      input.slug.length > 80 ||
      !/^[a-z][a-z0-9-]*$/.test(input.slug)
    )
      throw new AccessError("invalid");
  }
  private validateIdentity(value: string): void {
    if (typeof value !== "string" || !value.trim() || value.length > 255)
      throw new AccessError("invalid");
  }
  private async requireRole(id: string): Promise<Role> {
    const role = await this.store.findRole(id);
    if (!role) throw new AccessError("not_found");
    return role;
  }
  private async requireMember(id: string): Promise<Member> {
    const member = await this.store.findMember(id);
    if (!member) throw new AccessError("not_found");
    return member;
  }
}
