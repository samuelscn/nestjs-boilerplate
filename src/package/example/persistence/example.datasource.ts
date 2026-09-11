import "dotenv/config";
import { DataSource } from "typeorm";
import { appConfigFactory } from "src/config";
import { ExampleItemEntity } from "./entity/example-item.entity";

const config = appConfigFactory();

export default new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  entities: [ExampleItemEntity],
  migrations: [`${__dirname}/migration/*{.ts,.js}`],
  migrationsTableName: "example_migrations",
});
