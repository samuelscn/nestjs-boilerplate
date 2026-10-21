import { DataSourceOptions } from "typeorm";
import type { AppConfig } from "src/config";
import { PackageDatabase, quoteRole } from "src/package/shared/module/typeorm";
import { ExampleItemEntity } from "./entity/example-item.entity";

export const exampleDataSourceOptions = (
  database: AppConfig["database"],
): DataSourceOptions => ({
  name: "example",
  type: "postgres",
  host: database.host,
  port: database.port,
  username: database.username,
  password: database.password,
  database: database.name,
  entities: [ExampleItemEntity],
  migrations: [`${__dirname}/migration/*{.ts,.js}`],
  migrationsTableName: "example_migrations",
  migrationsRun: false,
});

export const exampleDatabase: PackageDatabase = {
  options: exampleDataSourceOptions,
  grantRuntime: async (source, runtimeRole) => {
    await source.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON example_item TO ${quoteRole(runtimeRole)}`,
    );
  },
};
