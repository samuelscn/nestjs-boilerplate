import { Controller, Get, INestApplication, Post } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { appConfigFactory } from "src/config";
import { ConfigModule } from "src/package/shared/module/config";
import { ProblemModule } from "src/package/shared/module/problem";
import {
  Permission,
  RequestContexts,
} from "src/package/shared/module/authorization";
import {
  AccessControlModule,
  AccessService,
  RequireAllPermissions,
  RequireAnyPermission,
  RequirePermission,
} from "../../index";
import { securityDatabase } from "../support/security-database";

@Controller("probe")
class ProbeController {
  constructor(
    private readonly contexts: RequestContexts,
    private readonly access: AccessService,
  ) {}
  @Get("unmarked") unmarked() {
    return "must never execute";
  }
  @Get("read")
  @RequirePermission(Permission.example.read)
  read() {
    return { tenantId: this.contexts.current().tenant?.id };
  }
  @Get("any")
  @RequireAnyPermission(Permission.example.read, Permission.example.create)
  any() {
    return "allowed";
  }
  @Get("all")
  @RequireAllPermissions(Permission.example.read, Permission.example.create)
  all() {
    return "allowed";
  }
  @Post("rollback")
  @RequirePermission(Permission.role.create)
  async rollback() {
    await this.access.createRole({
      name: "Rolled back",
      slug: "http-rollback",
      permissions: [Permission.example.read],
    });
    throw new Error("Downstream domain failure");
  }
}

@Controller("combined")
@RequirePermission(Permission.role.read)
class CombinedController {
  @Get()
  @RequirePermission(Permission.example.read)
  read() {
    return "both required";
  }
}

describe("Access HTTP boundary (tenant mode)", () => {
  let app: INestApplication,
    db: Awaited<ReturnType<typeof securityDatabase>>,
    server: Server;
  let tenantA: string,
    tenantB: string,
    readerMember: string,
    roleB: string,
    ownerMember: string,
    ownerRole: string;
  const identities = {
    ownerA: { userId: "usr_fake_a" },
    ownerB: { userId: "usr_fake_b" },
    reader: { userId: "usr_fake_admin" },
    stranger: { userId: "usr_fake_stranger" },
  };
  const fakeTokens = {
    ownerA: "fake-token-user-a",
    ownerB: "fake-token-user-b",
    reader: "fake-token-admin",
    stranger: "fake-token-stranger",
  } as const;
  const authenticated = (token: keyof typeof fakeTokens, tenant?: string) => ({
    Authorization: `Bearer ${fakeTokens[token]}`,
    ...(tenant ? { "x-tenant-id": tenant } : {}),
  });

  beforeAll(async () => {
    db = await securityDatabase("tenant", 4);
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [appConfigFactory] }),
        ProblemModule.forRoot(),
        AccessControlModule.forRoot("tenant"),
      ],
      controllers: [ProbeController, CombinedController],
    })
      .overrideProvider(getDataSourceToken("access-control"))
      .useValue(db.source)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    server = app.getHttpServer() as Server;
    const a = await request(server)
      .post("/tenants")
      .set(authenticated("ownerA"))
      .send({ name: "Tenant A", slug: "a" })
      .expect(201);
    const b = await request(server)
      .post("/tenants")
      .set(authenticated("ownerB"))
      .send({ name: "Tenant B", slug: "b" })
      .expect(201);
    tenantA = a.body.id as string;
    tenantB = b.body.id as string;
    await db.as(identities.ownerA, tenantA, async () => {
      readerMember = (await db.service.createMember(identities.reader.userId))
        .id;
      const reader = await db.service.createRole({
        name: "Reader",
        slug: "reader",
        permissions: [Permission.example.read],
      });
      await db.service.assignRole(readerMember, reader.id);
      ownerMember = (await db.service.listMembers()).find(
        (member) => member.identityUserId === identities.ownerA.userId,
      ).id;
      ownerRole = (await db.service.listRoles()).find(
        (role) => role.slug === "owner",
      ).id;
    });
    await db.as(identities.ownerB, tenantB, async () => {
      roleB = (
        await db.service.createRole({
          name: "B custom",
          slug: "custom",
          permissions: [Permission.example.read],
        })
      ).id;
    });
  });
  afterAll(async () => {
    if (app) await app.close();
    if (db) await db.close();
  });

  it("rejects missing/unverified identity; user and permissions headers are not identity", async () => {
    await request(server)
      .get("/access/roles")
      .set("x-tenant-id", tenantA)
      .expect(401);
    await request(server)
      .get("/access/roles")
      .set({
        "x-tenant-id": tenantA,
        "x-user-id": identities.ownerA.userId,
        "x-permissions": "role:read",
      })
      .expect(401);
    await request(server)
      .get("/access/roles")
      .set({
        ...authenticated("ownerA", tenantA),
        Authorization: "Bearer forged",
      })
      .expect(401);
  });
  it("requires tenant context and verified membership; refuses malformed and duplicate headers", async () => {
    await request(server)
      .get("/access/roles")
      .set(authenticated("ownerA"))
      .expect(403);
    for (const tenant of [
      tenantB,
      randomUUID(),
      "invalid",
      `${tenantA},${tenantB}`,
      `${tenantA}' OR true --`,
    ])
      await request(server)
        .get("/access/roles")
        .set(authenticated("ownerA", tenant))
        .expect(403);
    await request(server)
      .get("/access/roles")
      .set(authenticated("stranger", tenantA))
      .expect(403);
    await request(server)
      .get("/access/roles")
      .set("Authorization", "Bearer fake-token-user-a")
      // Deliberately sends duplicate wire headers; superagent's type only models strings.
      .set("x-tenant-id", [tenantA, tenantA] as unknown as string)
      .expect(403);
    await request(server)
      .post("/tenants")
      .set(authenticated("ownerA", tenantA))
      .send({ name: "bad", slug: "bad" })
      .expect(403);
  });
  it("enforces default deny, ANY, ALL and additive class/method requirements", async () => {
    await request(server)
      .get("/probe/unmarked")
      .set(authenticated("ownerA", tenantA))
      .expect(403);
    await request(server)
      .get("/access/roles")
      .set(authenticated("reader", tenantA))
      .expect(403);
    await request(server)
      .get("/probe/read")
      .set(authenticated("reader", tenantA))
      .expect(200, { tenantId: tenantA });
    await request(server)
      .get("/probe/any")
      .set(authenticated("reader", tenantA))
      .expect(200);
    await request(server)
      .get("/probe/all")
      .set(authenticated("reader", tenantA))
      .expect(403);
    await request(server)
      .get("/probe/all")
      .set(authenticated("ownerA", tenantA))
      .expect(200);
    await request(server)
      .get("/combined")
      .set(authenticated("reader", tenantA))
      .expect(403);
    await request(server)
      .get("/combined")
      .set(authenticated("ownerA", tenantA))
      .expect(200);
  });
  it("rejects payload tenantId/isSystem, arbitrary permissions, empty roles and reserved slugs", async () => {
    for (const body of [
      {
        name: "bad",
        slug: "bad",
        permissions: [Permission.example.read],
        tenantId: tenantB,
      },
      {
        name: "bad",
        slug: "bad",
        permissions: [Permission.example.read],
        isSystem: true,
      },
      { name: "bad", slug: "bad", permissions: ["unknown:permission"] },
      { name: "bad", slug: "bad", permissions: [] },
      { name: "bad", slug: "owner", permissions: [Permission.example.read] },
    ])
      await request(server)
        .post("/access/roles")
        .set(authenticated("ownerA", tenantA))
        .send(body)
        .expect(400);
    await request(server)
      .post("/access/members")
      .set(authenticated("ownerA", tenantA))
      .send({ identityUserId: "idp|new", tenantId: tenantB })
      .expect(400);
  });
  it("does not list, mutate or assign known foreign role/member IDs", async () => {
    const roles = await request(server)
      .get("/access/roles")
      .set(authenticated("ownerA", tenantA))
      .expect(200);
    expect(
      (roles.body as { id: string }[]).map((role) => role.id),
    ).not.toContain(roleB);
    await request(server)
      .put(`/access/roles/${roleB}`)
      .set(authenticated("ownerA", tenantA))
      .send({
        name: "attack",
        slug: "attack",
        permissions: [Permission.example.read],
      })
      .expect(404);
    await request(server)
      .delete(`/access/roles/${roleB}`)
      .set(authenticated("ownerA", tenantA))
      .expect(404);
    await request(server)
      .put(`/access/members/${readerMember}/roles/${roleB}`)
      .set(authenticated("ownerA", tenantA))
      .expect(404);
    await request(server)
      .delete(`/access/members/${readerMember}`)
      .set(authenticated("ownerB", tenantB))
      .expect(404);
    await request(server)
      .put(`/access/members/${readerMember}/roles/${roleB}`)
      .set(authenticated("ownerB", tenantB))
      .expect(404);
  });
  it("creates custom roles, assigns multiple roles and revokes access on permission replacement/deletion", async () => {
    const created = await request(server)
      .post("/access/roles")
      .set(authenticated("ownerA", tenantA))
      .send({
        name: "Writer",
        slug: "writer",
        permissions: [Permission.example.create],
      })
      .expect(201);
    const roleId = created.body.id as string;
    await request(server)
      .put(`/access/members/${readerMember}/roles/${roleId}`)
      .set(authenticated("ownerA", tenantA))
      .expect(204);
    await request(server)
      .get("/probe/all")
      .set(authenticated("reader", tenantA))
      .expect(200);
    await request(server)
      .put(`/access/roles/${roleId}`)
      .set(authenticated("ownerA", tenantA))
      .send({
        name: "Reader now",
        slug: "writer",
        permissions: [Permission.member.read],
      })
      .expect(200);
    await request(server)
      .get("/probe/all")
      .set(authenticated("reader", tenantA))
      .expect(403);
    await request(server)
      .get("/access/members")
      .set(authenticated("reader", tenantA))
      .expect(200);
    await request(server)
      .delete(`/access/roles/${roleId}`)
      .set(authenticated("ownerA", tenantA))
      .expect(204);
    await request(server)
      .get("/access/members")
      .set(authenticated("reader", tenantA))
      .expect(403);
  });
  it("keeps the last OWNER and rejects system role deletion", async () => {
    await request(server)
      .delete(`/access/members/${ownerMember}/roles/${ownerRole}`)
      .set(authenticated("ownerA", tenantA))
      .expect(409);
    await request(server)
      .delete(`/access/members/${ownerMember}`)
      .set(authenticated("ownerA", tenantA))
      .expect(409);
    await request(server)
      .delete(`/access/roles/${ownerRole}`)
      .set(authenticated("ownerA", tenantA))
      .expect(409);
  });
  it("rolls back writes if the HTTP handler fails before commit", async () => {
    await request(server)
      .post("/probe/rollback")
      .set(authenticated("ownerA", tenantA))
      .expect(500);
    const response = await request(server)
      .get("/access/roles")
      .set(authenticated("ownerA", tenantA))
      .expect(200);
    expect(
      (response.body as { slug: string }[]).map((role) => role.slug),
    ).not.toContain("http-rollback");
  });
  it("isolates concurrent requests on a pooled datasource", async () => {
    await Promise.all(
      Array.from({ length: 16 }, (_, index) => {
        const tenant = index % 2 ? tenantA : tenantB;
        return request(server)
          .get("/probe/read")
          .set(authenticated(index % 2 ? "ownerA" : "ownerB", tenant))
          .expect(200, { tenantId: tenant });
      }),
    );
    expect(await db.source.query("SELECT * FROM access_role")).toEqual([]);
  });
});
