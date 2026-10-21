import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import type { Server } from "node:http";
import request from "supertest";
import { appConfigFactory } from "src/config";
import { ConfigModule } from "src/package/shared/module/config";
import { ProblemModule } from "src/package/shared/module/problem";
import { AccessControlModule } from "../../access-control.module";
import { securityDatabase } from "../support/security-database";

describe("Member management (single mode)", () => {
  let db: Awaited<ReturnType<typeof securityDatabase>>;
  let app: INestApplication;
  let server: Server;
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const admin = as("fake-token-admin");
  let memberRole: string;
  let ownerRole: string;

  beforeAll(async () => {
    db = await securityDatabase("single");
    await db.service.initializeSingleApplication("usr_fake_admin");
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ load: [appConfigFactory] }),
        ProblemModule.forRoot(),
        AccessControlModule.forRoot("single"),
      ],
    })
      .overrideProvider(getDataSourceToken("access-control"))
      .useValue(db.source)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    server = app.getHttpServer() as Server;
    const roles = await request(server)
      .get("/access/roles")
      .set(admin)
      .expect(200);
    const bySlug = (slug: string) =>
      (roles.body as { id: string; slug: string }[]).find(
        (role) => role.slug === slug,
      ).id;
    memberRole = bySlug("member");
    ownerRole = bySlug("owner");
  });
  afterAll(async () => {
    await app?.close();
    await db?.close();
  });

  it("syncs the caller's display profile on /access/me", async () => {
    await request(server).get("/access/me").set(admin).expect(200);
    const page = await request(server)
      .get("/access/members")
      .set(admin)
      .expect(200);
    expect(page.body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(page.body.items[0]).toMatchObject({
      identityUserId: "usr_fake_admin",
      displayName: "Admin",
      email: "admin@example.com",
      status: "active",
      roleIds: [ownerRole],
    });
    expect(page.body.items[0].lastSeenAt).toEqual(expect.any(String));
  });

  it("invites by email and binds the invitation when the invitee signs in with that verified email", async () => {
    const invited = await request(server)
      .post("/access/members/invitations")
      .set(admin)
      .send({ email: "Invitee@Example.com", roleId: memberRole })
      .expect(201);
    expect(invited.body).toMatchObject({
      identityUserId: null,
      email: "invitee@example.com",
      status: "invited",
      roleIds: [memberRole],
    });
    const duplicate = await request(server)
      .post("/access/members/invitations")
      .set(admin)
      .send({ email: "invitee@example.com", roleId: memberRole })
      .expect(409);
    expect(duplicate.body.code).toBe("MEMBER_ALREADY_EXISTS");
    const pending = await request(server)
      .patch(`/access/members/${invited.body.id}/status`)
      .set(admin)
      .send({ status: "active" })
      .expect(422);
    expect(pending.body.code).toBe("INVITATION_PENDING");

    const me = await request(server)
      .get("/access/me")
      .set(as("fake-token-invitee"))
      .expect(200);
    expect(me.body).toEqual({
      userId: "usr_fake_invitee",
      roleIds: [memberRole],
      permissions: ["example:read"],
    });
    const claimed = await request(server)
      .get("/access/members")
      .query({ q: "invitee" })
      .set(admin)
      .expect(200);
    expect(claimed.body.items).toEqual([
      expect.objectContaining({
        identityUserId: "usr_fake_invitee",
        status: "active",
        displayName: "Invitee",
      }),
    ]);
  });

  it("never binds an invitation from an unverified email", async () => {
    await request(server)
      .post("/access/members/invitations")
      .set(admin)
      .send({ email: "stranger@example.com", roleId: memberRole })
      .expect(201);
    const me = await request(server)
      .get("/access/me")
      .set(as("fake-token-stranger"))
      .expect(200);
    expect(me.body.permissions).toEqual([]);
    const list = await request(server)
      .get("/access/members")
      .query({ status: "invited" })
      .set(admin)
      .expect(200);
    expect(
      list.body.items.map((item: { email: string }) => item.email),
    ).toEqual(["stranger@example.com"]);
  });

  it("suspension removes every permission and is reversible; self-suspension is refused", async () => {
    const list = await request(server)
      .get("/access/members")
      .query({ q: "invitee" })
      .set(admin);
    const invitee = list.body.items[0].id as string;
    await request(server)
      .patch(`/access/members/${invitee}/status`)
      .set(admin)
      .send({ status: "suspended" })
      .expect(200);
    await request(server)
      .get("/access/me")
      .set(as("fake-token-invitee"))
      .expect(200)
      .expect(({ body }) => expect(body.permissions).toEqual([]));
    await request(server)
      .patch(`/access/members/${invitee}/status`)
      .set(admin)
      .send({ status: "active" })
      .expect(200);
    await request(server)
      .get("/access/me")
      .set(as("fake-token-invitee"))
      .expect(({ body }) => expect(body.permissions).toEqual(["example:read"]));

    const self = (
      await request(server)
        .get("/access/members")
        .query({ q: "admin" })
        .set(admin)
    ).body.items[0].id as string;
    const refused = await request(server)
      .patch(`/access/members/${self}/status`)
      .set(admin)
      .send({ status: "suspended" })
      .expect(422);
    expect(refused.body.code).toBe("SELF_MANAGEMENT_FORBIDDEN");
  });

  it("filters by several roles and statuses, paginates and validates the query", async () => {
    const both = await request(server)
      .get(
        `/access/members?role=${memberRole}&role=${ownerRole}&status=active&pageSize=1&page=2`,
      )
      .set(admin)
      .expect(200);
    expect(both.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(both.body.items).toHaveLength(1);
    const clamped = await request(server)
      .get("/access/members?page=99")
      .set(admin)
      .expect(200);
    expect(clamped.body.page).toBe(1);
    const invalid = await request(server)
      .get("/access/members?status=root&pageSize=1000&role=not-a-uuid")
      .set(admin)
      .expect(400);
    expect(
      invalid.body.errors.map((error: { field: string }) => error.field).sort(),
    ).toEqual(["pageSize", "role", "status"]);
    await request(server)
      .get("/access/members")
      .set(as("fake-token-invitee"))
      .expect(403);
  });
});
