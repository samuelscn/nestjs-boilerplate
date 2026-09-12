import { EntityTarget, ObjectLiteral, QueryFailedError } from "typeorm";
import {
  AccessError,
  Identity,
  isPermission,
  RequestContext,
} from "src/package/shared/module/authorization";
import { TenantDatabase } from "src/package/shared/module/tenant-database";
import { AccessStore } from "../../core/contract/access-store";
import {
  AccessMode,
  AuditEvent,
  Member,
  Role,
  RoleInput,
  TenantInput,
} from "../../core/model/access.model";

/** Table names are fixed product constants; all caller values are bound parameters. */
export class AccessRepository extends AccessStore {
  constructor(
    readonly mode: AccessMode,
    private readonly database: TenantDatabase,
  ) {
    super();
  }

  async transaction<T>(
    scope: string | undefined,
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      if (this.mode === "tenant") {
        if (!scope) throw new AccessError("forbidden");
        return await this.database.runInTenantContext(scope, work);
      }
      if (scope) throw new AccessError("forbidden");
      return await this.database.runUnscoped(work);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const code = (error.driverError as { code?: string }).code;
        if (code === "23505") throw new AccessError("conflict");
        if (["23503", "23514", "22P02"].includes(code ?? ""))
          throw new AccessError("invalid");
        if (code === "42501") throw new AccessError("forbidden");
      }
      throw error;
    }
  }

  private get scope(): Record<string, string> {
    if (this.mode === "single") return {};
    const tenantId = this.database.tenantId();
    if (!tenantId) throw new AccessError("forbidden");
    return { tenantId };
  }
  private get memberTable(): string {
    return this.mode === "tenant"
      ? "access_membership"
      : "access_identity_user";
  }
  private repository<T extends ObjectLiteral>(entity: EntityTarget<T>) {
    return this.database.manager().getRepository(entity);
  }

  async lockScope(): Promise<void> {
    if (this.mode === "tenant") {
      const rows: unknown[] = await this.database
        .manager()
        .query("SELECT id FROM access_tenant WHERE id = $1 FOR UPDATE", [
          this.scope.tenantId,
        ]);
      if (!rows.length) throw new AccessError("forbidden");
    } else {
      const rows: unknown[] = await this.database
        .manager()
        .query(
          "SELECT name FROM access_lock WHERE name = 'application' FOR UPDATE",
        );
      if (!rows.length)
        throw new Error("Access migrations have not been applied");
    }
  }

  async loadContext(identity: Identity): Promise<RequestContext | null> {
    // A single joined query aggregates every role/permission; no per-role queries.
    const query = this.repository(this.memberTable)
      .createQueryBuilder("member")
      .leftJoin(
        "access_role_assignment",
        "assignment",
        'assignment."memberId" = member.id' +
          (this.mode === "tenant"
            ? ' AND assignment."tenantId" = member."tenantId"'
            : ""),
      )
      .leftJoin(
        "access_role",
        "role",
        'role.id = assignment."roleId"' +
          (this.mode === "tenant"
            ? ' AND role."tenantId" = member."tenantId"'
            : ""),
      )
      .leftJoin(
        "access_role_permission",
        "permission_grant",
        'permission_grant."roleId" = role.id' +
          (this.mode === "tenant"
            ? ' AND permission_grant."tenantId" = member."tenantId"'
            : ""),
      )
      .select("member.id", "memberId")
      .addSelect("role.id", "roleId")
      .addSelect('permission_grant."permissionId"', "permissionId")
      .where('member."identityUserId" = :identity', {
        identity: identity.userId,
      });
    if (this.mode === "tenant")
      query
        .innerJoin("access_tenant", "tenant", 'tenant.id = member."tenantId"')
        .andWhere('member."tenantId" = :tenantId', this.scope);
    const rows = await query.getRawMany<{
      memberId: string;
      roleId: string | null;
      permissionId: string | null;
    }>();
    if (!rows.length)
      return this.mode === "single"
        ? { identity, authorization: { roleIds: [], permissions: [] } }
        : null;
    return {
      identity,
      tenant:
        this.mode === "tenant"
          ? { id: this.scope.tenantId, membershipId: rows[0].memberId }
          : undefined,
      authorization: {
        roleIds: [
          ...new Set(
            rows
              .map((row) => row.roleId)
              .filter((value): value is string => !!value),
          ),
        ],
        permissions: [
          ...new Set(rows.map((row) => row.permissionId).filter(isPermission)),
        ],
      },
    };
  }

  async createTenant(id: string, input: TenantInput): Promise<void> {
    if (this.mode !== "tenant" || id !== this.scope.tenantId)
      throw new AccessError("forbidden");
    await this.repository("access_tenant").insert({
      id,
      name: input.name,
      slug: input.slug,
    });
  }

  async listRoles(): Promise<Role[]> {
    const roles = (await this.repository("access_role").find({
      where: this.scope,
      order: { createdAt: "ASC", id: "ASC" },
    })) as Omit<Role, "permissions">[];
    const grants = (await this.repository("access_role_permission").find({
      where: this.scope,
    })) as { roleId: string; permissionId: string }[];
    return roles.map((role) => ({
      ...role,
      permissions: grants
        .filter((grant) => grant.roleId === role.id)
        .map((grant) => grant.permissionId)
        .filter(isPermission),
    }));
  }
  async findRole(id: string): Promise<Role | null> {
    const role = (await this.repository("access_role").findOneBy({
      ...this.scope,
      id,
    })) as Omit<Role, "permissions"> | null;
    if (!role) return null;
    const grants = (await this.repository("access_role_permission").findBy({
      ...this.scope,
      roleId: id,
    })) as { permissionId: string }[];
    return {
      ...role,
      permissions: grants
        .map((grant) => grant.permissionId)
        .filter(isPermission),
    };
  }

  async saveRole(input: RoleInput, system = false, id?: string): Promise<Role> {
    const repository = this.repository("access_role");
    let roleId = id;
    if (id) {
      const result = await repository.update(
        { ...this.scope, id, isSystem: false },
        {
          name: input.name,
          slug: input.slug,
          description: input.description ?? null,
        },
      );
      if (result.affected !== 1) throw new AccessError("not_found");
      await this.repository("access_role_permission").delete({
        ...this.scope,
        roleId: id,
      });
    } else {
      const result = await repository.insert({
        ...this.scope,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        isSystem: system,
      });
      roleId = result.identifiers[0].id as string;
    }
    const permissions = [...new Set(input.permissions)];
    if (permissions.length)
      await this.repository("access_role_permission").insert(
        permissions.map((permissionId) => ({
          ...this.scope,
          roleId,
          permissionId,
        })),
      );
    return await this.findRole(roleId);
  }

  async deleteRole(id: string): Promise<void> {
    const result = await this.repository("access_role").delete({
      ...this.scope,
      id,
      isSystem: false,
    });
    if (result.affected !== 1) throw new AccessError("not_found");
  }

  async listMembers(): Promise<Member[]> {
    const members = (await this.repository(this.memberTable).findBy(
      this.scope,
    )) as Omit<Member, "roleIds">[];
    const assignments = (await this.repository("access_role_assignment").findBy(
      this.scope,
    )) as { memberId: string; roleId: string }[];
    return members.map((member) => ({
      ...member,
      roleIds: assignments
        .filter((assignment) => assignment.memberId === member.id)
        .map((assignment) => assignment.roleId),
    }));
  }
  async findMember(id: string): Promise<Member | null> {
    const member = (await this.repository(this.memberTable).findOneBy({
      ...this.scope,
      id,
    })) as Omit<Member, "roleIds"> | null;
    if (!member) return null;
    const assignments = (await this.repository("access_role_assignment").findBy(
      { ...this.scope, memberId: id },
    )) as { roleId: string }[];
    return {
      ...member,
      roleIds: assignments.map((assignment) => assignment.roleId),
    };
  }
  async createMember(identityUserId: string): Promise<Member> {
    const result = await this.repository(this.memberTable).insert({
      ...this.scope,
      identityUserId,
    });
    return {
      id: result.identifiers[0].id as string,
      identityUserId,
      roleIds: [],
    };
  }
  async deleteMember(id: string): Promise<void> {
    await this.repository(this.memberTable).delete({ ...this.scope, id });
  }
  async assignRole(memberId: string, roleId: string): Promise<void> {
    await this.repository("access_role_assignment").insert({
      ...this.scope,
      memberId,
      roleId,
    });
  }
  async unassignRole(memberId: string, roleId: string): Promise<void> {
    await this.repository("access_role_assignment").delete({
      ...this.scope,
      memberId,
      roleId,
    });
  }
  async countOwners(): Promise<number> {
    const owner = await this.repository("access_role").findOneBy({
      ...this.scope,
      slug: "owner",
      isSystem: true,
    });
    return owner
      ? this.repository("access_role_assignment").countBy({
          ...this.scope,
          roleId: owner.id,
        })
      : 0;
  }
  async audit(
    event: AuditEvent,
    actorId: string,
    targetId: string,
  ): Promise<void> {
    await this.repository("access_audit").insert({
      ...this.scope,
      event,
      actorId,
      targetId,
    });
  }
}
