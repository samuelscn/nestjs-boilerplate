import { DataSource } from "typeorm";

/** tenantId is the explicit entity convention, checked on every participating DataSource. */
export async function assertTenantEntities(source: DataSource): Promise<void> {
  const scoped = source.entityMetadatas.filter((entity) =>
    entity.columns.some((column) => column.propertyName === "tenantId"),
  );
  if (!scoped.length) return;
  for (const entity of scoped) {
    const column = entity.columns.find(
      (column) => column.propertyName === "tenantId",
    );
    if (column.isNullable || column.type !== "uuid")
      throw new Error(`${entity.tableName}: tenantId must be UUID NOT NULL`);
    const indexed =
      [...entity.indices, ...entity.uniques].some(
        (index) => index.columns[0]?.propertyName === "tenantId",
      ) || entity.primaryColumns[0]?.propertyName === "tenantId";
    if (!indexed)
      throw new Error(
        `${entity.tableName}: tenantId must lead an index or key`,
      );
    const table = `${entity.schema ?? "public"}.${entity.tableName}`;
    const rows: { enabled: boolean; forced: boolean; unsafe: boolean }[] =
      await source.query(
        `SELECT c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
      pg_has_role(current_user, c.relowner, 'MEMBER') OR has_table_privilege(current_user, c.oid, 'TRUNCATE,TRIGGER,REFERENCES') AS unsafe
      FROM pg_class c WHERE c.oid = to_regclass($1)`,
        [table],
      );
    if (
      rows.length !== 1 ||
      !rows[0].enabled ||
      !rows[0].forced ||
      rows[0].unsafe
    )
      throw new Error(`${table}: unsafe tenant table or missing FORCE RLS`);
    const policies: { expression: string; check: string }[] =
      await source.query(
        `SELECT pg_get_expr(polqual, polrelid) AS expression, pg_get_expr(polwithcheck, polrelid) AS check
      FROM pg_policy WHERE polrelid = to_regclass($1) AND polname = 'tenant_fence' AND NOT polpermissive AND polcmd = '*'`,
        [table],
      );
    const normalize = (value: string) =>
      (value ?? "")
        .replace(/[\s()"]/g, "")
        .replaceAll("::text", "")
        .toLowerCase();
    const expected = normalize(
      `${column.databaseName} = nullif(current_setting('app.tenant_id', true), '')::uuid`,
    );
    if (
      policies.length !== 1 ||
      normalize(policies[0].expression) !== expected ||
      normalize(policies[0].check) !== expected
    )
      throw new Error(`${table}: missing restrictive tenant fence`);
  }
  const privileged: unknown[] = await source.query(
    "SELECT oid FROM pg_roles WHERE pg_has_role(current_user, oid, 'MEMBER') AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)",
  );
  if (privileged.length) throw new Error("Unsafe tenant database login");
}
