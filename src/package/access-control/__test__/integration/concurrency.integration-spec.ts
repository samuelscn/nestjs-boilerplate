import { randomUUID } from "node:crypto";
import {
  Permission,
  RequestContext,
} from "src/package/shared/module/authorization";
import { securityDatabase } from "../support/security-database";

describe("Concurrent ownership, revocation and bootstrap", () => {
  let db: Awaited<ReturnType<typeof securityDatabase>>;
  beforeAll(async () => {
    db = await securityDatabase("tenant", 4);
  });
  afterAll(async () => {
    if (db) await db.close();
  });

  it("cannot remove both owners concurrently", async () => {
    const first = { userId: "idp|owner-1" },
      second = { userId: "idp|owner-2" };
    const tenant = (await db.signup(first, "owners")).id;
    let ownerRole: string, firstMember: string, secondMember: string;
    await db.as(first, tenant, async () => {
      ownerRole = (await db.service.listRoles()).find(
        (role) => role.slug === "owner",
      ).id;
      firstMember = (await db.service.listMembers())[0].id;
      secondMember = (await db.service.createMember(second.userId)).id;
      await db.service.assignRole(secondMember, ownerRole);
    });
    const results = await Promise.allSettled([
      db.as(first, tenant, () =>
        db.service.unassignRole(firstMember, ownerRole),
      ),
      db.as(second, tenant, () =>
        db.service.unassignRole(secondMember, ownerRole),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await db.tenantDatabase.runInTenantContext(tenant, async () =>
      expect(await db.repository.countOwners()).toBe(1),
    );
  });

  it("rechecks authorization after a revocation waiting on the same scope lock", async () => {
    const owner = { userId: "idp|revoker" },
      reader = { userId: "idp|revoked" };
    const tenant = (await db.signup(owner, "revocation")).id;
    let member: string, role: string;
    await db.as(owner, tenant, async () => {
      member = (await db.service.createMember(reader.userId)).id;
      role = (
        await db.service.createRole({
          name: "Reader",
          slug: "reader",
          permissions: [Permission.role.read],
        })
      ).id;
      await db.service.assignRole(member, role);
    });
    const stale: RequestContext = await db.service.resolve(reader, tenant);
    let announce: () => void, release: () => void;
    const revoked = new Promise<void>((resolve) => {
      announce = resolve;
    });
    const commit = new Promise<void>((resolve) => {
      release = resolve;
    });
    const revocation = db.as(owner, tenant, async () => {
      await db.service.unassignRole(member, role);
      announce();
      await commit;
    });
    await revoked;
    const operation = jest.fn(() => Promise.resolve());
    const pending = db.service.runAuthorized(
      stale.identity,
      stale.tenant.id,
      [{ mode: "all", permissions: [Permission.role.read] }],
      operation,
    );
    const denied = expect(pending).rejects.toMatchObject({ code: "forbidden" });
    release();
    await revocation;
    await denied;
    expect(operation).not.toHaveBeenCalled();
    await expect(
      db.contexts.run(stale, () => db.service.listRoles()),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("racing signup for the same slug commits one fully initialized tenant", async () => {
    const outcomes = await Promise.allSettled([
      db.signup({ userId: "idp|signup-1" }, "same-slug"),
      db.signup({ userId: "idp|signup-2" }, "same-slug"),
    ]);
    const success = outcomes.filter(
      (outcome) => outcome.status === "fulfilled",
    );
    expect(success).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    await db.tenantDatabase.runInTenantContext(
      success[0].value.id,
      async () => {
        expect(await db.repository.countOwners()).toBe(1);
        expect(await db.repository.listRoles()).toHaveLength(3);
        expect(await db.repository.listMembers()).toHaveLength(1);
      },
    );
  });

  it("the database rejects committing a tenant without an owner", async () => {
    const id = randomUUID();
    await expect(
      db.tenantDatabase.runInTenantContext(id, () =>
        db.repository.createTenant(id, { name: "Partial", slug: "partial" }),
      ),
    ).rejects.toMatchObject({ driverError: { code: "23514" } });
    await db.tenantDatabase.runInTenantContext(id, async () =>
      expect(
        await db.tenantDatabase.manager().query("SELECT * FROM access_tenant"),
      ).toEqual([]),
    );
  });

  it("one identity has independent roles in different tenants", async () => {
    const subject = { userId: "idp|shared" },
      other = { userId: "idp|other" };
    const a = (await db.signup(subject, "shared-a")).id;
    const b = (await db.signup(other, "shared-b")).id;
    await db.as(other, b, async () => {
      const member = await db.service.createMember(subject.userId);
      const role = await db.service.createRole({
        name: "Reader",
        slug: "reader",
        permissions: [Permission.example.read],
      });
      await db.service.assignRole(member.id, role.id);
    });
    const ca = await db.service.resolve(subject, a),
      cb = await db.service.resolve(subject, b);
    expect(ca.authorization.permissions).toContain(Permission.role.assign);
    expect(cb.authorization.permissions).toEqual([Permission.example.read]);
    expect(
      cb.authorization.roleIds.some((id) =>
        ca.authorization.roleIds.includes(id),
      ),
    ).toBe(false);
  });

  it("a delegated ADMIN cannot grant ownership despite having all product permissions", async () => {
    const owner = { userId: "idp|delegator" },
      admin = { userId: "idp|delegated" };
    const tenant = (await db.signup(owner, "delegate")).id;
    let member: string, ownerRole: string;
    await db.as(owner, tenant, async () => {
      const roles = await db.service.listRoles();
      ownerRole = roles.find((role) => role.slug === "owner").id;
      member = (await db.service.createMember(admin.userId)).id;
      await db.service.assignRole(
        member,
        roles.find((role) => role.slug === "admin").id,
      );
    });
    await expect(
      db.as(admin, tenant, () => db.service.assignRole(member, ownerRole)),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
