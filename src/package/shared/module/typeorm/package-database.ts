import { DataSource, DataSourceOptions } from "typeorm";
import type { AppConfig } from "src/config";

/** What `src/database/migrate.ts` needs from a package that owns tables. */
export interface PackageDatabase {
  /** Same options as the runtime connection, built for the given credentials. */
  options(database: AppConfig["database"]): DataSourceOptions;
  /** Least-privilege grants for the runtime role, applied after migrations. */
  grantRuntime(source: DataSource, runtimeRole: string): Promise<void>;
}

const ROLE = /^[a-z_][a-z0-9_]{0,62}$/;

/** Validates and quotes a role name; grants cannot be parameterized. */
export function quoteRole(role: string): string {
  if (!ROLE.test(role)) throw new Error(`Invalid database role: ${role}`);
  return `"${role}"`;
}
