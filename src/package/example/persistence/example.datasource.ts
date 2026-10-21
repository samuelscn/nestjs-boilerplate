import "dotenv/config";
import { DataSource } from "typeorm";
import { appConfigFactory } from "src/config";
import { exampleDataSourceOptions } from "./example-database";

export default new DataSource(
  exampleDataSourceOptions(appConfigFactory().database),
);
