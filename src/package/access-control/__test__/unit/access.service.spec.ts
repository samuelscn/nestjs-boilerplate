import {
  AuthorizationService,
  Permission,
  RequestContext,
  RequestContexts,
} from "src/package/shared/module/authorization";
import { AccessStore } from "../../core/contract/access-store";
import { AccessService } from "../../core/service/access.service";

describe("AccessService authorization decisions", () => {
  const context: RequestContext = {
    identity: { userId: "idp|administrator" },
    tenant: { id: "tenant-a", membershipId: "member-a" },
    authorization: {
      roleIds: ["custom-admin"],
      permissions: [
        Permission.role.read,
        Permission.role.create,
        Permission.role.update,
        Permission.role.assign,
      ],
    },
  };
  let contexts: RequestContexts, service: AccessService;
  const store = {
    mode: "tenant",
    transaction: jest.fn((_scope: string, work: () => Promise<unknown>) =>
      work(),
    ),
    lockScope: jest.fn(),
    loadContext: jest.fn(),
    saveRole: jest.fn(),
    findRole: jest.fn(),
    findMember: jest.fn(),
    assignRole: jest.fn(),
    audit: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    store.lockScope.mockResolvedValue(undefined);
    store.loadContext.mockResolvedValue(context);
    contexts = new RequestContexts();
    service = new AccessService(
      store as unknown as AccessStore,
      new AuthorizationService(),
      contexts,
    );
  });
  it("refuses work without a request context or a nonempty explicit requirement", async () => {
    expect(() => service.listRoles()).toThrow("forbidden");
    const work = jest.fn();
    await expect(
      service.runAuthorized(context.identity, context.tenant.id, [], work),
    ).rejects.toThrow("forbidden");
    expect(work).not.toHaveBeenCalled();
  });
  it("rejects missing scope and a revoked membership before executing the callback", async () => {
    await expect(service.resolve(context.identity)).rejects.toThrow(
      "forbidden",
    );
    store.loadContext.mockResolvedValue(null);
    const work = jest.fn();
    await expect(
      service.runAuthorized(
        context.identity,
        context.tenant.id,
        [{ mode: "all", permissions: [Permission.role.read] }],
        work,
      ),
    ).rejects.toThrow("forbidden");
    expect(work).not.toHaveBeenCalled();
  });
  it.each([
    { permissions: [] },
    { permissions: ["unknown:permission"] },
    { permissions: [Permission.member.remove] },
  ])(
    "does not delegate absent/unknown permissions (%j)",
    async ({ permissions }) => {
      await expect(
        contexts.run(context, () =>
          service.createRole({ name: "Role", slug: "custom", permissions }),
        ),
      ).rejects.toThrow();
      expect(store.saveRole).not.toHaveBeenCalled();
    },
  );
  it.each(["owner", "admin", "member"])(
    "reserves system slug %s",
    async (slug) => {
      await expect(
        contexts.run(context, () =>
          service.createRole({
            name: "Fake system",
            slug,
            permissions: [Permission.role.read],
          }),
        ),
      ).rejects.toThrow("invalid");
      expect(store.saveRole).not.toHaveBeenCalled();
    },
  );
  it("permits delegation of an explicit subset and audits the actor", async () => {
    store.saveRole.mockResolvedValue({ id: "new-role" });
    await contexts.run(context, () =>
      service.createRole({
        name: "Read roles",
        slug: "read-roles",
        permissions: [Permission.role.read],
      }),
    );
    expect(store.saveRole).toHaveBeenCalledWith({
      name: "Read roles",
      slug: "read-roles",
      permissions: [Permission.role.read],
    });
    expect(store.audit).toHaveBeenCalledWith(
      "role.created",
      context.identity.userId,
      "new-role",
    );
  });
  it("refuses changing an existing role that has permissions beyond the actor", async () => {
    store.findRole.mockResolvedValue({
      id: "higher",
      permissions: [Permission.member.remove],
      isSystem: false,
    });
    await expect(
      contexts.run(context, () =>
        service.updateRole("higher", {
          name: "Remove power",
          slug: "higher",
          permissions: [Permission.role.read],
        }),
      ),
    ).rejects.toThrow("forbidden");
    expect(store.saveRole).not.toHaveBeenCalled();
  });
});
