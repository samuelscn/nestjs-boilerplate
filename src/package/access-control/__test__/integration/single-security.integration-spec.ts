import { Permission } from "src/package/shared/module/authorization";
import { securityDatabase } from "../support/security-database";

describe("Single-application RBAC", () => {
  let db: Awaited<ReturnType<typeof securityDatabase>>;
  const owner = { userId: "idp|single-owner" };
  beforeAll(async () => {
    db = await securityDatabase("single");
    await db.service.initializeSingleApplication(owner.userId);
  });
  afterAll(async () => {
    if (db) await db.close();
  });

  it("has no tenant/membership tables, tenant columns or RLS policies", async () => {
    const tables: { table_name: string }[] = await db.source.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    expect(tables.map((table) => table.table_name)).not.toContain(
      "access_tenant",
    );
    expect(tables.map((table) => table.table_name)).not.toContain(
      "access_membership",
    );
    expect(
      await db.source.query(
        "SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenantId'",
      ),
    ).toEqual([]);
    expect(
      await db.source.query(
        "SELECT * FROM pg_policies WHERE schemaname = 'public'",
      ),
    ).toEqual([]);
  });
  it("shares the engine, supports multiple roles and revokes permissions immediately", async () => {
    const subject = { userId: "idp|single-member" };
    let member: string, writer: string;
    await db.as(owner, undefined, async () => {
      member = (await db.service.createMember(subject.userId)).id;
      const reader = await db.service.createRole({
        name: "Reader",
        slug: "reader",
        permissions: [Permission.example.read],
      });
      writer = (
        await db.service.createRole({
          name: "Writer",
          slug: "writer",
          permissions: [Permission.example.create],
        })
      ).id;
      await db.service.assignRole(member, reader.id);
      await db.service.assignRole(member, writer);
    });
    expect(
      (await db.service.resolve(subject)).authorization.roleIds,
    ).toHaveLength(2);
    await expect(
      db.as(
        subject,
        undefined,
        () => Promise.resolve("allowed"),
        Permission.example.create,
      ),
    ).resolves.toBe("allowed");
    await db.as(owner, undefined, () => db.service.deleteRole(writer));
    await expect(
      db.as(
        subject,
        undefined,
        () => Promise.resolve(),
        Permission.example.create,
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      db.service.initializeSingleApplication("idp|attacker"),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(db.service.resolve(owner, "tenant")).rejects.toMatchObject({
      code: "forbidden",
    });
  });
  it("unknown identities have zero permissions and cannot manage roles", async () => {
    const unknown = { userId: "idp|unknown" };
    expect(
      (await db.service.resolve(unknown)).authorization.permissions,
    ).toEqual([]);
    await expect(
      db.as(unknown, undefined, () => db.service.listRoles()),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
  it("preserves the last owner", async () => {
    await db.as(owner, undefined, async () => {
      const member = (await db.service.listMembers()).find(
        (member) => member.identityUserId === owner.userId,
      );
      const role = (await db.service.listRoles()).find(
        (role) => role.slug === "owner",
      );
      await expect(
        db.service.unassignRole(member.id, role.id),
      ).rejects.toMatchObject({ code: "conflict" });
      await expect(db.service.removeMember(member.id)).rejects.toMatchObject({
        code: "conflict",
      });
    });
  });
});
