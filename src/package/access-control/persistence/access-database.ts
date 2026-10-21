import { DataSource } from "typeorm";
import { PackageDatabase, quoteRole } from "src/package/shared/module/typeorm";
import type { AccessMode } from "../core/model/access.model";
import { accessDataSourceOptions } from "./access-options";

/** Runtime grants checked by AccessDatabaseCheck; tests share this function. */
export async function grantAccessRuntime(
  source: DataSource,
  mode: AccessMode,
  runtimeRole: string,
): Promise<void> {
  const role = quoteRole(runtimeRole);
  const memberTable =
    mode === "tenant" ? "access_membership" : "access_identity_user";
  await source.transaction(async (manager) => {
    await manager.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    await manager.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON access_role, access_role_permission, access_role_assignment, ${memberTable} TO ${role}`,
    );
    await manager.query(`GRANT SELECT ON access_permission TO ${role}`);
    await manager.query(`GRANT SELECT, INSERT ON access_audit TO ${role}`);
    await manager.query(
      mode === "tenant"
        ? `GRANT SELECT, INSERT, UPDATE ON access_tenant TO ${role}`
        : `GRANT SELECT, UPDATE ON access_lock TO ${role}`,
    );
  });
}

export const accessDatabase = (mode: AccessMode): PackageDatabase => ({
  options: (database) => accessDataSourceOptions(database, mode),
  grantRuntime: (source, runtimeRole) =>
    grantAccessRuntime(source, mode, runtimeRole),
});
