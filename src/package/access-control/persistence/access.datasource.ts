import "dotenv/config";
import { DataSource } from "typeorm";
import { appConfigFactory } from "src/config";
import { accessDataSourceOptions } from "./access-options";

// CLI uses migration credentials supplied through DATABASE_*; runtime never migrates.
const configuration = appConfigFactory();
export default new DataSource(
  accessDataSourceOptions(
    configuration.database,
    configuration.authorization.mode,
  ),
);
