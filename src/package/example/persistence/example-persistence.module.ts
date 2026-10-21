import { Module } from "@nestjs/common";
import { ConfigService } from "src/package/shared/module/config";
import { TypeOrmPersistenceModule } from "src/package/shared/module/typeorm";
import { ApplicationConfig } from "src/config";
import { exampleDataSourceOptions } from "./example-database";
import { ExampleItemRepository } from "./repository/example-item.repository";

@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      name: "example",
      inject: [ConfigService],
      useFactory: (config: ConfigService<ApplicationConfig>) => ({
        ...exampleDataSourceOptions(config.get("database")),
        synchronize: config.get("env") === "test",
      }),
    }),
  ],
  providers: [ExampleItemRepository],
  exports: [ExampleItemRepository],
})
export class ExamplePersistenceModule {}
