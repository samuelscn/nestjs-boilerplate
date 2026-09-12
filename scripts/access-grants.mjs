import "dotenv/config";
import { DataSource } from "typeorm";

const [
  mode = process.env.AUTHORIZATION_MODE ?? "single",
  runtimeRole = "ginga_app",
] = process.argv.slice(2);
if (
  !["single", "tenant"].includes(mode) ||
  !/^[a-z_][a-z0-9_]{0,62}$/.test(runtimeRole)
)
  throw new Error(
    "Usage: npm run database:access:grant -- <single|tenant> <runtime_role>",
  );
const source = await new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 5432),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
}).initialize();
try {
  const roles = await source.query(
    "SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = $1",
    [runtimeRole],
  );
  if (roles.length !== 1 || Object.values(roles[0]).some(Boolean))
    throw new Error(
      "Runtime role must already exist and have no privileged attributes",
    );
  await source.transaction(async (manager) => {
    await manager.query(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
    await manager.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON access_role, access_role_permission, access_role_assignment, ${mode === "tenant" ? "access_membership" : "access_identity_user"} TO "${runtimeRole}"`,
    );
    await manager.query(
      `GRANT SELECT ON access_permission TO "${runtimeRole}"`,
    );
    await manager.query(
      `GRANT SELECT, INSERT ON access_audit TO "${runtimeRole}"`,
    );
    await manager.query(
      mode === "tenant"
        ? `GRANT SELECT, INSERT, UPDATE ON access_tenant TO "${runtimeRole}"`
        : `GRANT SELECT, UPDATE ON access_lock TO "${runtimeRole}"`,
    );
  });
  console.log(
    "Access-control runtime grants applied. Provision business-package grants separately.",
  );
} finally {
  await source.destroy();
}
