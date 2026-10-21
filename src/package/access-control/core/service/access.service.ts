import { Injectable } from "@nestjs/common";
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
import { AccessStore } from "../contract/access-store";
import {
  Member,
  Role,
  RoleInput,
  AccessProblem,
  SYSTEM_ROLES,
  TenantInput,
} from "../model/access.model";

@Injectable()
export class AccessService {
  constructor(
    private readonly store: AccessStore,
    private readonly authorization: AuthorizationService,
    private readonly contexts: RequestContexts,
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
