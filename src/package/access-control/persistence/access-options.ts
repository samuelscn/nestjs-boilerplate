import { DataSourceOptions } from "typeorm";
import type { AppConfig } from "src/config";
import type { AccessMode } from "../core/model/access.model";
import { SINGLE_ENTITIES } from "./entity/single.entity";
import { TENANT_ENTITIES } from "./entity/tenant.entity";

export function accessDataSourceOptions(
  database: AppConfig["database"],
  mode: AccessMode,
): DataSourceOptions {
  return {
    name: "access-control",
    type: "postgres",
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.name,
    uuidExtension: "pgcrypto",
    installExtensions: false,
    entities: mode === "tenant" ? TENANT_ENTITIES : SINGLE_ENTITIES,
    migrations: [`${__dirname}/migration/${mode}/*{.ts,.js}`],
    migrationsTableName: "access_migrations",
    synchronize: false,
    migrationsRun: false,
  };
}
