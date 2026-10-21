import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import {
  AccessError,
  AuthorizationService,
  Identity,
  Permission,
  RequestContexts,
} from "src/package/shared/module/authorization";
import { TenantDatabase } from "src/package/shared/module/tenant-database";
import { AccessMode } from "../../core/model/access.model";
import { AccessService } from "../../core/service/access.service";
import { AccessDatabaseCheck } from "../../persistence/access-database-check";
import { grantAccessRuntime } from "../../persistence/access-database";
import { accessDataSourceOptions } from "../../persistence/access-options";
import { AccessRepository } from "../../persistence/repository/access.repository";

/** Fresh physical DB + non-superuser owner + least-privilege runtime login per suite. */
export async function securityDatabase(mode: AccessMode, poolSize = 2) {
  const suffix = randomUUID().replaceAll("-", "");
  const name = `rbac_${suffix}`;
  const owner = `owner_${suffix}`;
  const runtime = `runtime_${suffix}`;
  const password = randomUUID();
  const database = {
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT),
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
  };
  const admin = await new DataSource({
    type: "postgres",
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.name,
  }).initialize();
  // Identifiers/passwords below are generated hexadecimal/UUID values, never caller input.
  await admin.query(
    `CREATE ROLE "${owner}" LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
  );
  await admin.query(
    `CREATE ROLE "${runtime}" LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
  );
  await admin.query(`CREATE DATABASE "${name}" OWNER "${owner}"`);
  const migration = await new DataSource(
    accessDataSourceOptions(
      { ...database, name, username: owner, password },
      mode,
    ),
  ).initialize();
  await migration.runMigrations();
  await migration.query("REVOKE CREATE ON SCHEMA public FROM PUBLIC");
  await grantAccessRuntime(migration, mode, runtime);
  const options = accessDataSourceOptions(
    { ...database, name, username: runtime, password },
    mode,
  );
  const source = await new DataSource({
    ...options,
    extra: { max: poolSize },
  }).initialize();
  await new AccessDatabaseCheck(source, mode).onModuleInit();
  const tenantDatabase = new TenantDatabase(source);
  await tenantDatabase.onModuleInit();
  const repository = new AccessRepository(mode, tenantDatabase);
  const contexts = new RequestContexts();
  const authorization = new AuthorizationService();
  const service = new AccessService(repository, authorization, contexts);
  const signup = (identity: Identity, slug: string) =>
    contexts.run(
      { identity, authorization: { roleIds: [], permissions: [] } },
      () => service.createTenant({ name: slug, slug }),
    );
  const as = <T>(
    identity: Identity,
    tenantId: string | undefined,
    work: () => Promise<T>,
    permission: Permission = Permission.role.read,
  ) =>
    service.runAuthorized(
      identity,
      tenantId,
      [{ mode: "all", permissions: [permission] }],
      work,
    );
  return {
    runtime,
    admin,
    migration,
    source,
    options,
    tenantDatabase,
    repository,
    contexts,
    authorization,
    service,
    signup,
    as,
    async close() {
      if (source.isInitialized) await source.destroy();
      if (migration.isInitialized) await migration.destroy();
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
      await admin.query(`DROP ROLE "${runtime}"`);
      await admin.query(`DROP ROLE "${owner}"`);
      await admin.destroy();
    },
  };
}

export const forbidden = new AccessError("forbidden");
