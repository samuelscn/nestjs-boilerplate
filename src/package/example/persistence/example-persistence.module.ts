import { Module } from "@nestjs/common";
import { ConfigService } from "src/package/shared/module/config";
import { TypeOrmPersistenceModule } from "src/package/shared/module/typeorm";
import { ApplicationConfig } from "src/config";
import { ExampleItemEntity } from "./entity/example-item.entity";
import { ExampleItemRepository } from "./repository/example-item.repository";

@Module({
  imports: [
    TypeOrmPersistenceModule.forRoot({
      name: "example",
      inject: [ConfigService],
      useFactory: (config: ConfigService<ApplicationConfig>) => ({
        name: "example",
        type: "postgres",
        host: config.get("database.host"),
        port: config.get("database.port"),
        username: config.get("database.username"),
        password: config.get("database.password"),
        database: config.get("database.name"),
        entities: [ExampleItemEntity],
        migrations: [`${__dirname}/migration/*{.ts,.js}`],
        migrationsTableName: "example_migrations",
        migrationsRun: config.get("env") === "production",
        synchronize: config.get("env") === "test",
      }),
    }),
  ],
  providers: [ExampleItemRepository],
  exports: [ExampleItemRepository],
})
export class ExamplePersistenceModule {}
