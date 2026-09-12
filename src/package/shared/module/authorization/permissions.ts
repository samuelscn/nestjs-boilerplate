/** Product-owned catalog. Tenant input never extends this definition. */
export function definePermissions<
  const T extends Record<string, readonly string[]>,
>(
  definition: T,
): {
  readonly [R in keyof T]: {
    readonly [A in T[R][number]]: `${R & string}:${A}`;
  };
} {
  const result = Object.create(null) as Record<string, Record<string, string>>;
  for (const [resource, actions] of Object.entries(definition)) {
    if (!/^[a-z][a-z0-9-]*$/.test(resource))
      throw new Error("Invalid resource");
    result[resource] = Object.create(null) as Record<string, string>;
    for (const action of actions) {
      if (!/^[a-z][a-z0-9-]*$/.test(action)) throw new Error("Invalid action");
      result[resource][action] = `${resource}:${action}`;
    }
    Object.freeze(result[resource]);
  }
  return Object.freeze(result) as {
    readonly [R in keyof T]: {
      readonly [A in T[R][number]]: `${R & string}:${A}`;
    };
  };
}

export const Permission = definePermissions({
  role: ["read", "create", "update", "delete", "assign"],
  member: ["read", "invite", "update", "remove"],
  example: ["read", "create"],
});
type Values<T> = T[keyof T];
export type Permission = Values<{
  [R in keyof typeof Permission]: Values<(typeof Permission)[R]>;
}>;
export const PERMISSIONS: readonly Permission[] = Object.freeze(
  Object.values(Permission).flatMap(Object.values),
);
export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && PERMISSIONS.includes(value as Permission);
}
