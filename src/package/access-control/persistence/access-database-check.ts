import { OnModuleInit } from "@nestjs/common";
import { DataSource } from "typeorm";
import { PERMISSIONS } from "src/package/shared/module/authorization";
import type { AccessMode } from "../core/model/access.model";

export class AccessDatabaseCheck implements OnModuleInit {
  constructor(
    private readonly source: DataSource,
    private readonly mode: AccessMode,
  ) {}
  async onModuleInit(): Promise<void> {
    const schema: { tenant: boolean }[] = await this.source.query(
      "SELECT to_regclass('public.access_tenant') IS NOT NULL AS tenant",
    );
    if (schema[0].tenant !== (this.mode === "tenant"))
      throw new Error("Authorization mode does not match the migrated schema");
    const dangerous: unknown[] = await this.source
      .query(`SELECT rolname FROM pg_roles
      WHERE pg_has_role(current_user, oid, 'MEMBER') AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)`);
    const ownership: unknown[] = await this.source
      .query(`SELECT relname FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relname LIKE 'access_%'
      AND pg_has_role(current_user, relowner, 'MEMBER')`);
    const privileges: { unsafe: boolean }[] = await this.source.query(`SELECT
      has_schema_privilege(current_user, 'public', 'CREATE')
      OR has_table_privilege(current_user, 'access_permission', 'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
      OR has_table_privilege(current_user, 'access_audit', 'UPDATE,DELETE,TRUNCATE,TRIGGER') AS unsafe`);
    const bypassPrivileges: unknown[] = await this.source
      .query(`SELECT relname FROM pg_class
      WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname LIKE 'access_%'
      AND has_table_privilege(current_user, oid, 'TRUNCATE,TRIGGER,REFERENCES')`);
    if (
      dangerous.length ||
      ownership.length ||
      privileges[0].unsafe ||
      bypassPrivileges.length
    )
      throw new Error(
        "Unsafe access-control database role: use a restricted runtime user, separate from migrations",
      );
    const permissions: { id: string }[] = await this.source.query(
      "SELECT id FROM access_permission",
    );
    if (
      PERMISSIONS.some(
        (permission) => !permissions.some((row) => row.id === permission),
      )
    )
      throw new Error("Permission catalog migration required");
    if (this.mode === "tenant") {
      const tables: {
        relname: string;
        relrowsecurity: boolean;
        relforcerowsecurity: boolean;
      }[] = await this.source
        .query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relnamespace = 'public'::regnamespace AND relname IN ('access_tenant', 'access_membership', 'access_role', 'access_role_permission', 'access_role_assignment', 'access_audit')`);
      if (
        tables.length !== 6 ||
        tables.some(
          (table) => !table.relrowsecurity || !table.relforcerowsecurity,
        )
      )
        throw new Error("Mandatory FORCE RLS migration missing");
      const fences: { tablename: string; qual: string; with_check: string }[] =
        await this.source
          .query(`SELECT tablename, qual, with_check FROM pg_policies
        WHERE schemaname = 'public' AND policyname = 'tenant_fence' AND permissive = 'RESTRICTIVE' AND cmd = 'ALL'`);
      const normalize = (expression: string) =>
        expression
          .replace(/[\s()"]/g, "")
          .replaceAll("::text", "")
          .toLowerCase();
      if (
        tables.some(
          (table) =>
            !fences.some(
              (fence) =>
                fence.tablename === table.relname &&
                fence.qual === fence.with_check &&
                normalize(fence.qual) ===
                  normalize(
                    `${table.relname === "access_tenant" ? "id" : "tenantId"} = nullif(current_setting('app.tenant_id', true), '')::uuid`,
                  ),
            ),
        )
      )
        throw new Error("Mandatory restrictive tenant policy missing");
    }
  }
}
