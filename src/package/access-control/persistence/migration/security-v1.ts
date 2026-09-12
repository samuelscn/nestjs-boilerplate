import { QueryRunner } from "typeorm";

// Frozen migration snapshot: never import the live product permission catalog here.
const CATALOG_V1 = [
  "role:read",
  "role:create",
  "role:update",
  "role:delete",
  "role:assign",
  "member:read",
  "member:invite",
  "member:update",
  "member:remove",
  "example:read",
  "example:create",
];
const SCOPED_V1 = [
  "access_tenant",
  "access_membership",
  "access_role",
  "access_role_permission",
  "access_role_assignment",
  "access_audit",
];

/** SQL-only features unsupported by TypeORM schema generation; versioned and tested. */
export async function installSecurityV1(
  runner: QueryRunner,
  tenant: boolean,
): Promise<void> {
  for (const permission of CATALOG_V1)
    await runner.query(
      "INSERT INTO access_permission(id) VALUES ($1) ON CONFLICT DO NOTHING",
      [permission],
    );
  if (!tenant)
    await runner.query(
      "INSERT INTO access_lock(name) VALUES ('application') ON CONFLICT DO NOTHING",
    );
  if (tenant) {
    for (const table of SCOPED_V1) {
      const column = table === "access_tenant" ? '"id"' : '"tenantId"';
      const predicate = `${column} = nullif(current_setting('app.tenant_id', true), '')::uuid`;
      await runner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await runner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      // Restrictive fence cannot be widened by adding another permissive policy.
      await runner.query(
        `CREATE POLICY tenant_fence ON "${table}" AS RESTRICTIVE FOR ALL USING (${predicate}) WITH CHECK (${predicate})`,
      );
      await runner.query(
        `CREATE POLICY tenant_access ON "${table}" FOR ALL USING (true) WITH CHECK (true)`,
      );
    }
  }
  await runner.query(`CREATE FUNCTION access_protect_system_role() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
    BEGIN
      IF OLD."isSystem" THEN RAISE EXCEPTION 'System roles are immutable' USING ERRCODE = '23514'; END IF;
      IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
      IF NEW."isSystem" THEN RAISE EXCEPTION 'Cannot promote a custom role' USING ERRCODE = '23514'; END IF;
      RETURN NEW;
    END $$`);
  await runner.query(`CREATE TRIGGER access_system_role BEFORE UPDATE OR DELETE ON access_role
    FOR EACH ROW EXECUTE FUNCTION access_protect_system_role()`);
  await runner.query(`CREATE FUNCTION access_require_owner() RETURNS trigger
    LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
    DECLARE scope_id uuid;
    BEGIN
      ${
        tenant
          ? `scope_id := nullif(current_setting('app.tenant_id', true), '')::uuid;
      IF scope_id IS NULL THEN RAISE EXCEPTION 'Tenant context required' USING ERRCODE = '23514'; END IF;
      PERFORM id FROM public.access_tenant WHERE id = scope_id FOR UPDATE;
      IF NOT FOUND THEN RETURN NULL; END IF;`
          : `PERFORM name FROM public.access_lock WHERE name = 'application' FOR UPDATE;`
      }
      IF NOT EXISTS (
        SELECT 1 FROM public.access_role r JOIN public.access_role_assignment a ON a."roleId" = r.id
        ${tenant ? 'AND a."tenantId" = r."tenantId"' : ""}
        WHERE r.slug = 'owner' AND r."isSystem" ${tenant ? 'AND r."tenantId" = scope_id' : ""}
      ) THEN RAISE EXCEPTION 'At least one owner is required' USING ERRCODE = '23514'; END IF;
      RETURN NULL;
    END $$`);
  for (const table of [
    "access_role",
    "access_role_assignment",
    ...(tenant ? ["access_tenant"] : []),
  ]) {
    await runner.query(`CREATE CONSTRAINT TRIGGER access_owner_invariant AFTER INSERT OR UPDATE OR DELETE ON "${table}"
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION access_require_owner()`);
  }
  await runner.query(
    "REVOKE ALL ON FUNCTION access_protect_system_role() FROM PUBLIC",
  );
  await runner.query(
    "REVOKE ALL ON FUNCTION access_require_owner() FROM PUBLIC",
  );
}

export async function removeSecurityV1(
  runner: QueryRunner,
  tenant: boolean,
): Promise<void> {
  for (const table of [
    "access_role",
    "access_role_assignment",
    ...(tenant ? ["access_tenant"] : []),
  ])
    await runner.query(`DROP TRIGGER access_owner_invariant ON "${table}"`);
  await runner.query("DROP FUNCTION access_require_owner()");
  await runner.query("DROP TRIGGER access_system_role ON access_role");
  await runner.query("DROP FUNCTION access_protect_system_role()");
  if (tenant)
    for (const table of SCOPED_V1) {
      await runner.query(`DROP POLICY tenant_fence ON "${table}"`);
      await runner.query(`DROP POLICY tenant_access ON "${table}"`);
      await runner.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      await runner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
  // Catalog rows are retained until schema rollback; grants may still reference them.
}
