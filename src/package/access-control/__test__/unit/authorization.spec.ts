import {
  AccessError,
  AuthorizationService,
  definePermissions,
  isPermission,
  Permission,
  RequestContext,
  RequestContexts,
} from "src/package/shared/module/authorization";

describe("Authorization core", () => {
  const authorization = new AuthorizationService();
  const context: RequestContext = {
    identity: { userId: "idp|user" },
    authorization: {
      roleIds: ["reader", "writer"],
      permissions: [Permission.example.read, Permission.example.create],
    },
  };

  it("denies missing identity, permission, metadata, unknown permissions and empty requirements", () => {
    expect(authorization.can(undefined, Permission.role.create)).toBe(false);
    expect(authorization.can(context, Permission.role.create)).toBe(false);
    expect(authorization.can(context, "unknown:read" as Permission)).toBe(
      false,
    );
    expect(authorization.allows(context, undefined)).toBe(false);
    expect(authorization.hasAllPermissions(context)).toBe(false);
    expect(authorization.hasAnyPermission(context)).toBe(false);
    expect(
      authorization.can(
        { ...context, identity: { userId: "" } },
        Permission.example.read,
      ),
    ).toBe(false);
  });
  it("evaluates ANY and ALL explicitly", () => {
    expect(authorization.hasPermission(context, Permission.example.read)).toBe(
      true,
    );
    expect(
      authorization.allows(context, {
        mode: "any",
        permissions: [Permission.role.create, Permission.example.read],
      }),
    ).toBe(true);
    expect(
      authorization.allows(context, {
        mode: "all",
        permissions: [Permission.example.create, Permission.example.read],
      }),
    ).toBe(true);
    expect(
      authorization.allows(context, {
        mode: "all",
        permissions: [Permission.role.create, Permission.example.read],
      }),
    ).toBe(false);
    expect(
      authorization.hasAnyPermission(
        context,
        Permission.example.read,
        "bad:read" as Permission,
      ),
    ).toBe(false);
  });
  it("produces frozen literal identifiers and rejects malformed definitions", () => {
    const catalog = definePermissions({ project: ["read", "create"] });
    const literal: "project:create" = catalog.project.create;
    expect(literal).toBe("project:create");
    expect(Object.isFrozen(catalog.project)).toBe(true);
    expect(isPermission("arbitrary:permission")).toBe(false);
    expect(() => definePermissions({ "bad:resource": ["read"] })).toThrow();
    expect(() => definePermissions({ valid: ["bad:action"] })).toThrow();
    // @ts-expect-error Product identifiers cannot be invented by callers.
    authorization.can(context, "project:unknown");
  });
  it("isolates concurrent request contexts and freezes permission arrays", async () => {
    const contexts = new RequestContexts();
    expect(() => contexts.current()).toThrow(AccessError);
    await Promise.all(
      ["a", "b"].map((userId) =>
        contexts.run({ ...context, identity: { userId } }, async () => {
          await Promise.resolve();
          expect(contexts.current().identity.userId).toBe(userId);
          expect(() =>
            (contexts.current().authorization.permissions as Permission[]).push(
              Permission.role.create,
            ),
          ).toThrow();
        }),
      ),
    );
    expect(() => contexts.current()).toThrow(AccessError);
  });
});
