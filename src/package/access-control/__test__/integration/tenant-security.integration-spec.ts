import { randomUUID } from "node:crypto";
import {
  AccessError,
  Permission,
} from "src/package/shared/module/authorization";
import { AccessDatabaseCheck } from "../../persistence/access-database-check";
import { securityDatabase } from "../support/security-database";

describe("Tenant RBAC and PostgreSQL security", () => {
  let db: Awaited<ReturnType<typeof securityDatabase>>;
  const userA = { userId: "idp|a" },
    userB = { userId: "idp|b" };
  let tenantA: string,
    tenantB: string,
    roleA: string,
    roleB: string,
    memberA: string,
    memberB: string;
  beforeAll(async () => {
    db = await securityDatabase("tenant", 1);
    tenantA = (await db.signup(userA, "tenant-a")).id;
    tenantB = (await db.signup(userB, "tenant-b")).id;
    await db.as(userA, tenantA, async () => {
      roleA = (
        await db.service.createRole({
          name: "Reader A",
          slug: "reader",
          permissions: [Permission.example.read],
        })
      ).id;
      memberA = (await db.service.listMembers())[0].id;
    });
    await db.as(userB, tenantB, async () => {
      roleB = (
        await db.service.createRole({
          name: "Reader B",
          slug: "reader",
          permissions: [Permission.example.read],
        })
      ).id;
      memberB = (await db.service.listMembers())[0].id;
    });
  });
  afterAll(async () => {
    if (db) await db.close();
  });

  it("uses generated migrations and refuses superuser/owner application connections", async () => {
    await expect(
      new AccessDatabaseCheck(db.migration, "tenant").onModuleInit(),
    ).rejects.toThrow("Unsafe");
    const migrations: unknown[] = await db.migration.query(
      "SELECT * FROM access_migrations",
    );
    expect(migrations).toHaveLength(2);
  });
  it("denies absent, nonexistent and nonmember tenant contexts", async () => {
    await expect(db.service.resolve(userA)).rejects.toThrow(AccessError);
    await expect(db.service.resolve(userA, randomUUID())).rejects.toThrow(
      AccessError,
    );
    await expect(db.service.resolve(userA, tenantB)).rejects.toThrow(
      AccessError,
    );
  });
  it("refuses runtime privileges that bypass RLS and a widened tenant policy", async () => {
    await db.migration.query(
      `GRANT TRUNCATE ON access_role TO "${db.runtime}"`,
    );
    try {
      await expect(
        new AccessDatabaseCheck(db.source, "tenant").onModuleInit(),
      ).rejects.toThrow("Unsafe");
    } finally {
      await db.migration.query(
        `REVOKE TRUNCATE ON access_role FROM "${db.runtime}"`,
      );
    }
    await db.migration.query(
      "ALTER POLICY tenant_fence ON access_role USING (true) WITH CHECK (true)",
    );
    try {
      await expect(db.tenantDatabase.onModuleInit()).rejects.toThrow(
        "missing restrictive tenant fence",
      );
      await expect(
        new AccessDatabaseCheck(db.source, "tenant").onModuleInit(),
      ).rejects.toThrow("restrictive tenant policy");
    } finally {
      await db.migration.query(
        `ALTER POLICY tenant_fence ON access_role USING ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK ("tenantId" = nullif(current_setting('app.tenant_id', true), '')::uuid)`,
      );
    }
    await new AccessDatabaseCheck(db.source, "tenant").onModuleInit();
  });
  it("RLS returns zero rows without context, including for a non-superuser table owner", async () => {
    for (const source of [db.source, db.migration]) {
      for (const table of [
        "access_tenant",
        "access_membership",
        "access_role",
        "access_role_permission",
        "access_role_assignment",
        "access_audit",
      ]) {
        expect(await source.query(`SELECT * FROM ${table}`)).toEqual([]);
      }
    }
  });
  it("RLS blocks read/update/delete of known foreign IDs even without application tenant filters", async () => {
    await db.tenantDatabase.runInTenantContext(tenantA, async () => {
      const manager = db.tenantDatabase.manager();
      expect(
        await manager.query("SELECT * FROM access_role WHERE id = $1", [roleB]),
      ).toEqual([]);
      expect(
        await manager.query('SELECT DISTINCT "tenantId" FROM access_role'),
      ).toEqual([{ tenantId: tenantA }]);
      expect(
        await manager.query(
          "UPDATE access_role SET name = $1 WHERE id = $2 RETURNING id",
          ["ATTACK", roleB],
        ),
      ).toEqual([[], 0]);
      expect(
        await manager.query(
          "DELETE FROM access_role WHERE id = $1 RETURNING id",
          [roleB],
        ),
      ).toEqual([[], 0]);
    });
  });
  it("RLS rejects inserts and changes of tenantId into another tenant", async () => {
    await expect(
      db.tenantDatabase.runInTenantContext(tenantA, () =>
        db.tenantDatabase
          .manager()
          .query(
            'INSERT INTO access_role ("tenantId", name, slug) VALUES ($1, $2, $3)',
            [tenantB, "attack", "attack"],
          ),
      ),
    ).rejects.toMatchObject({ driverError: { code: "42501" } });
    await expect(
      db.tenantDatabase.runInTenantContext(tenantA, () =>
        db.tenantDatabase
          .manager()
          .query('UPDATE access_role SET "tenantId" = $1 WHERE id = $2', [
            tenantB,
            roleA,
          ]),
      ),
    ).rejects.toMatchObject({ driverError: { code: "42501" } });
    await expect(
      db.source.query(
        'INSERT INTO access_role ("tenantId", name, slug) VALUES ($1, $2, $3)',
        [tenantA, "attack", "attack"],
      ),
    ).rejects.toMatchObject({ driverError: { code: "42501" } });
  });
  it("composite FKs block cross-tenant membership and role assignments directly in SQL", async () => {
    for (const [member, role] of [
      [memberA, roleB],
      [memberB, roleA],
    ]) {
      await expect(
        db.tenantDatabase.runInTenantContext(tenantA, () =>
          db.tenantDatabase
            .manager()
            .query(
              'INSERT INTO access_role_assignment ("tenantId", "memberId", "roleId") VALUES ($1, $2, $3)',
              [tenantA, member, role],
            ),
        ),
      ).rejects.toMatchObject({ driverError: { code: "23503" } });
    }
    await expect(
      db.tenantDatabase.runInTenantContext(tenantA, () =>
        db.tenantDatabase
          .manager()
          .query(
            'INSERT INTO access_role_permission ("tenantId", "roleId", "permissionId") VALUES ($1, $2, $3)',
            [tenantA, roleB, Permission.role.assign],
          ),
      ),
    ).rejects.toMatchObject({ driverError: { code: "23503" } });
  });
  it("application scoping denies listing, mutation and assignment of foreign roles/members", async () => {
    await db.as(userA, tenantA, async () => {
      expect(
        (await db.service.listRoles()).map((role) => role.id),
      ).not.toContain(roleB);
      await expect(
        db.service.updateRole(roleB, {
          name: "attack",
          slug: "attack",
          permissions: [Permission.example.read],
        }),
      ).rejects.toMatchObject({ code: "not_found" });
      await expect(db.service.deleteRole(roleB)).rejects.toMatchObject({
        code: "not_found",
      });
      await expect(db.service.assignRole(memberA, roleB)).rejects.toMatchObject(
        { code: "not_found" },
      );
      await expect(db.service.assignRole(memberB, roleA)).rejects.toMatchObject(
        { code: "not_found" },
      );
      await expect(db.service.removeMember(memberB)).rejects.toMatchObject({
        code: "not_found",
      });
    });
  });
  it("rejects unknown and empty permissions; unique constraints reject duplicates", async () => {
    await db.as(userA, tenantA, async () => {
      for (const permissions of [[], ["invented:permission"]])
        await expect(
          db.service.createRole({ name: "bad", slug: "bad", permissions }),
        ).rejects.toMatchObject({ code: "invalid" });
    });
    await expect(
      db.as(userA, tenantA, () => db.service.createMember(userA.userId)),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      db.as(userA, tenantA, () =>
        db.service.createRole({
          name: "duplicate",
          slug: "reader",
          permissions: [Permission.example.read],
        }),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await db.as(userA, tenantA, () => db.service.assignRole(memberA, roleA));
    await expect(
      db.as(userA, tenantA, () => db.service.assignRole(memberA, roleA)),
    ).rejects.toMatchObject({ code: "conflict" });
  });
  it("multiple roles aggregate permissions and updates/revocations take effect on next resolution", async () => {
    const subject = { userId: "idp|multi" };
    let member: string, writer: string;
    await db.as(userA, tenantA, async () => {
      member = (await db.service.createMember(subject.userId)).id;
      writer = (
        await db.service.createRole({
          name: "Writer",
          slug: "writer",
          permissions: [Permission.example.create],
        })
      ).id;
      await db.service.assignRole(member, roleA);
      await db.service.assignRole(member, writer);
    });
    let resolved = await db.service.resolve(subject, tenantA);
    expect(resolved.authorization.roleIds).toHaveLength(2);
    expect([...resolved.authorization.permissions].sort()).toEqual(
      [Permission.example.create, Permission.example.read].sort(),
    );
    await db.as(userA, tenantA, () =>
      db.service.updateRole(writer, {
        name: "Writer",
        slug: "writer",
        permissions: [Permission.member.read],
      }),
    );
    resolved = await db.service.resolve(subject, tenantA);
    expect(resolved.authorization.permissions).not.toContain(
      Permission.example.create,
    );
    expect(resolved.authorization.permissions).toContain(
      Permission.member.read,
    );
    await db.as(userA, tenantA, () => db.service.unassignRole(member, roleA));
    expect(
      (await db.service.resolve(subject, tenantA)).authorization.permissions,
    ).not.toContain(Permission.example.read);
    await expect(
      db.as(subject, tenantA, () => Promise.resolve()),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
  it("prevents privilege escalation through role creation, updates and assignment", async () => {
    const limited = { userId: "idp|limited" };
    let ownerRole: string;
    await db.as(userA, tenantA, async () => {
      const member = await db.service.createMember(limited.userId);
      const role = await db.service.createRole({
        name: "Limited",
        slug: "limited",
        permissions: [
          Permission.role.read,
          Permission.role.create,
          Permission.role.update,
          Permission.role.assign,
        ],
      });
      await db.service.assignRole(member.id, role.id);
      ownerRole = (await db.service.listRoles()).find(
        (role) => role.slug === "owner",
      ).id;
    });
    await db.as(limited, tenantA, async () => {
      await expect(
        db.service.createRole({
          name: "Escalate",
          slug: "escalate",
          permissions: [Permission.member.remove],
        }),
      ).rejects.toMatchObject({ code: "forbidden" });
      await expect(
        db.service.updateRole(roleA, {
          name: "Escalate",
          slug: "escalate",
          permissions: [Permission.role.read],
        }),
      ).rejects.toMatchObject({ code: "forbidden" });
      await expect(
        db.service.assignRole(memberA, ownerRole),
      ).rejects.toMatchObject({ code: "forbidden" });
    });
  });
  it("prevents system role mutation and last-owner removal, including direct SQL", async () => {
    let owner: string;
    await db.as(userA, tenantA, async () => {
      owner = (await db.service.listRoles()).find(
        (role) => role.slug === "owner",
      ).id;
      await expect(db.service.deleteRole(owner)).rejects.toMatchObject({
        code: "conflict",
      });
      await expect(
        db.service.unassignRole(memberA, owner),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(db.service.removeMember(memberA)).rejects.toMatchObject({
        code: "conflict",
      });
    });
    await expect(
      db.tenantDatabase.runInTenantContext(tenantA, () =>
        db.tenantDatabase
          .manager()
          .query('DELETE FROM access_role_assignment WHERE "roleId" = $1', [
            owner,
          ]),
      ),
    ).rejects.toMatchObject({ driverError: { code: "23514" } });
    await expect(
      db.tenantDatabase.runInTenantContext(tenantA, () =>
        db.tenantDatabase
          .manager()
          .query("UPDATE access_role SET name = $1 WHERE id = $2", [
            "attack",
            owner,
          ]),
      ),
    ).rejects.toMatchObject({ driverError: { code: "23514" } });
  });
  it("rolls back every bootstrap write and audit when an intermediate step fails", async () => {
    const failure = jest
      .spyOn(db.repository, "assignRole")
      .mockRejectedValueOnce(new Error("injected failure"));
    await expect(
      db.signup({ userId: "idp|rollback" }, "rollback"),
    ).rejects.toThrow("injected failure");
    failure.mockRestore();
    // Owner is subject to FORCE RLS: inspect the rolled-back tenant via a captured ID.
    const create = jest.spyOn(db.repository, "createTenant");
    jest
      .spyOn(db.repository, "audit")
      .mockRejectedValueOnce(new Error("audit failure"));
    await expect(
      db.signup({ userId: "idp|rollback" }, "rollback"),
    ).rejects.toThrow("audit failure");
    const id = create.mock.calls[0][0];
    jest.restoreAllMocks();
    await db.tenantDatabase.runInTenantContext(id, async () => {
      for (const table of [
        "access_tenant",
        "access_membership",
        "access_role",
        "access_role_assignment",
        "access_audit",
      ])
        expect(
          await db.tenantDatabase.manager().query(`SELECT * FROM ${table}`),
        ).toEqual([]);
    });
    await expect(
      db.signup({ userId: "idp|rollback" }, "rollback"),
    ).resolves.toHaveProperty("id");
  });
  it("has no pool leakage after commit, rollback or concurrent callers, reusing one connection", async () => {
    const pids = new Set<number>();
    const run = (id: string) =>
      db.tenantDatabase.runInTenantContext(id, async () => {
        const rows: { tenant: string; pid: number }[] = await db.tenantDatabase
          .manager()
          .query(
            "SELECT current_setting('app.tenant_id', true) AS tenant, pg_backend_pid() AS pid",
          );
        pids.add(rows[0].pid);
        expect(rows[0].tenant).toBe(id);
        const tenants: { tenantId: string }[] = await db.tenantDatabase
          .manager()
          .query('SELECT DISTINCT "tenantId" FROM access_role');
        expect(tenants).toEqual([{ tenantId: id }]);
      });
    for (let iteration = 0; iteration < 4; iteration++) {
      await run(tenantA);
      await run(tenantB);
    }
    await expect(
      db.tenantDatabase.runInTenantContext(tenantA, () =>
        Promise.reject(new Error("rollback")),
      ),
    ).rejects.toThrow("rollback");
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        run(index % 2 ? tenantA : tenantB),
      ),
    );
    expect(pids.size).toBe(1);
    expect(await db.source.query("SELECT * FROM access_role")).toEqual([]);
    await db.tenantDatabase.runUnscoped(async () => {
      expect(
        await db.tenantDatabase.manager().query("SELECT * FROM access_role"),
      ).toEqual([]);
    });
    expect(() => db.tenantDatabase.manager()).toThrow("live database context");
    await expect(
      db.tenantDatabase.runInTenantContext(tenantA, () =>
        db.tenantDatabase.runInTenantContext(tenantB, () => Promise.resolve()),
      ),
    ).rejects.toThrow("Cannot change");
  });
  it("writes audit atomically and runtime cannot mutate the catalog or audit history", async () => {
    await db.tenantDatabase.runInTenantContext(tenantA, async () => {
      const events: { event: string }[] = await db.tenantDatabase
        .manager()
        .query("SELECT event FROM access_audit");
      expect(events.map((row) => row.event)).toEqual(
        expect.arrayContaining([
          "tenant.created",
          "role.created",
          "membership.created",
          "role.assigned",
          "role.permissions.updated",
        ]),
      );
    });
    await expect(
      db.source.query(
        "INSERT INTO access_permission VALUES ('fake:permission')",
      ),
    ).rejects.toMatchObject({ driverError: { code: "42501" } });
    await expect(
      db.source.query("DELETE FROM access_audit"),
    ).rejects.toMatchObject({ driverError: { code: "42501" } });
  });
});
