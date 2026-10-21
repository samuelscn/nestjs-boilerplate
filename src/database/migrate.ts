import "dotenv/config";
import { DataSource } from "typeorm";
import { appConfigFactory } from "src/config";
import { accessDatabase } from "src/package/access-control";
import { exampleDatabase } from "src/package/example";
import type { PackageDatabase } from "src/package/shared/module/typeorm";

/**
 * Applies every package's migrations with the migration role, then grants the runtime role
 * (DATABASE_USERNAME) what it needs. Idempotent: runs locally (`npm run db:migrate`) and in
 * the Railway preDeployCommand (`node dist/database/migrate.js`). Register new packages below.
 */
async function migrate(): Promise<void> {
  const config = appConfigFactory();
  const runtimeRole = config.database.username;
  const migrator = {
    ...config.database,
    username: process.env.MIGRATION_DATABASE_USERNAME ?? "",
    password: process.env.MIGRATION_DATABASE_PASSWORD ?? "",
  };
  if (!migrator.username || migrator.username === runtimeRole)
    throw new Error(
      "MIGRATION_DATABASE_USERNAME must be set and differ from the runtime DATABASE_USERNAME",
    );
  const packages: PackageDatabase[] = [
    accessDatabase(config.authorization.mode),
    // ExampleModule only exists in single mode (app.module.ts).
    ...(config.authorization.mode === "single" ? [exampleDatabase] : []),
  ];
  for (const database of packages) {
    const source = await new DataSource(
      database.options(migrator),
    ).initialize();
    try {
      const applied = await source.runMigrations({ transaction: "each" });
      await database.grantRuntime(source, runtimeRole);
      console.log(
        `${String(source.options.name)}: ${applied.length} migration(s) applied, runtime grants ok`,
      );
    } finally {
      await source.destroy();
    }
  }
}

migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
