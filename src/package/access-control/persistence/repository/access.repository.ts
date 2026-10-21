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
  AccessProblem,
  AuditEvent,
  Member,
  MemberPage,
  MemberQuery,
  MemberStatus,
  Role,
  RoleInput,
  TenantInput,
} from "../../core/model/access.model";

type MemberRow = Omit<Member, "roleIds">;
const toMember = (row: MemberRow, roleIds: string[]): Member => ({
  id: row.id,
  identityUserId: row.identityUserId,
  email: row.email,
  displayName: row.displayName,
  status: row.status,
  lastSeenAt: row.lastSeenAt,
  profileSyncedAt: row.profileSyncedAt,
  roleIds,
});

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
        if (code === "23505")
          throw new AccessError(
            "conflict",
            (error.driverError as { table?: string }).table === this.memberTable
              ? AccessProblem.MEMBER_ALREADY_EXISTS
              : undefined,
          );
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
      })
      // Suspended members keep their data but receive no permissions.
      .andWhere("member.status = 'active'");
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
    )) as MemberRow[];
    return this.withRoles(members);
  }
  async listMembersPage(query: MemberQuery): Promise<MemberPage> {
    const builder = this.repository(this.memberTable).createQueryBuilder(
      "member",
    );
    if (this.mode === "tenant")
      builder.where('member."tenantId" = :tenantId', this.scope);
    if (query.q)
      builder.andWhere(
        "(member.\"displayName\" ILIKE :q ESCAPE '\\' OR member.email ILIKE :q ESCAPE '\\')",
        { q: `%${query.q.replace(/[\\%_]/g, "\\$&")}%` },
      );
    if (query.statuses.length)
      builder.andWhere("member.status IN (:...statuses)", {
        statuses: [...query.statuses],
      });
    if (query.roleIds.length)
      builder.andWhere(
        `EXISTS (SELECT 1 FROM access_role_assignment assignment WHERE assignment."memberId" = member.id AND assignment."roleId" IN (:...roleIds)${this.mode === "tenant" ? ' AND assignment."tenantId" = member."tenantId"' : ""})`,
        { roleIds: [...query.roleIds] },
      );
    const total = await builder.getCount();
    const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
    const page = Math.min(query.page, pageCount);
    const rows = (await builder
      .orderBy(
        "lower(coalesce(member.\"displayName\", member.email, ''))",
        "ASC",
      )
      .addOrderBy("member.id", "ASC")
      .offset((page - 1) * query.pageSize)
      .limit(query.pageSize)
      .getMany()) as MemberRow[];
    return {
      items: await this.withRoles(rows),
      total,
      page,
      pageSize: query.pageSize,
    };
  }
  private async withRoles(members: MemberRow[]): Promise<Member[]> {
    if (!members.length) return [];
    const assignments = (await this.repository("access_role_assignment")
      .createQueryBuilder("assignment")
      .where('assignment."memberId" IN (:...ids)', {
        ids: members.map((member) => member.id),
      })
      .getMany()) as { memberId: string; roleId: string }[];
    return members.map((member) =>
      toMember(
        member,
        assignments
          .filter((assignment) => assignment.memberId === member.id)
          .map((assignment) => assignment.roleId),
      ),
    );
  }
  async findMemberByIdentity(identityUserId: string): Promise<Member | null> {
    const member = (await this.repository(this.memberTable).findOneBy({
      ...this.scope,
      identityUserId,
    })) as MemberRow | null;
    return member ? (await this.withRoles([member]))[0] : null;
  }
  async inviteMember(email: string): Promise<Member> {
    const result = await this.repository(this.memberTable).insert({
      ...this.scope,
      email,
      status: "invited",
      identityUserId: null,
    });
    return await this.findMember(result.identifiers[0].id as string);
  }
  async claimInvitation(
    identityUserId: string,
    email: string,
  ): Promise<boolean> {
    const result = await this.repository(this.memberTable)
      .createQueryBuilder()
      .update()
      .set({ identityUserId, status: "active" })
      .where("lower(email) = lower(:email)", { email })
      .andWhere("status = 'invited'")
      .andWhere('"identityUserId" IS NULL')
      .andWhere(
        this.mode === "tenant" ? '"tenantId" = :tenantId' : "TRUE",
        this.scope,
      )
      .execute();
    return result.affected === 1;
  }
  async updateMemberStatus(id: string, status: MemberStatus): Promise<void> {
    const result = await this.repository(this.memberTable).update(
      { ...this.scope, id },
      { status },
    );
    if (result.affected !== 1) throw new AccessError("not_found");
  }
  async updateProfile(
    id: string,
    profile: {
      displayName?: string | null;
      email?: string | null;
      lastSeenAt?: Date;
      profileSyncedAt?: Date;
    },
  ): Promise<void> {
    await this.repository(this.memberTable).update(
      { ...this.scope, id },
      profile,
    );
  }
  async findMember(id: string): Promise<Member | null> {
    const member = (await this.repository(this.memberTable).findOneBy({
      ...this.scope,
      id,
    })) as MemberRow | null;
    return member ? (await this.withRoles([member]))[0] : null;
  }
  async createMember(identityUserId: string): Promise<Member> {
    const result = await this.repository(this.memberTable).insert({
      ...this.scope,
      identityUserId,
      status: "active",
    });
    return await this.findMember(result.identifiers[0].id as string);
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
    if (!owner) return 0;
    // Only active owners count: a suspended owner cannot administer the scope.
    return this.repository("access_role_assignment")
      .createQueryBuilder("assignment")
      .innerJoin(
        this.memberTable,
        "member",
        'member.id = assignment."memberId"' +
          (this.mode === "tenant"
            ? ' AND member."tenantId" = assignment."tenantId"'
            : ""),
      )
      .where('assignment."roleId" = :roleId', { roleId: owner.id })
      .andWhere("member.status = 'active'")
      .getCount();
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
