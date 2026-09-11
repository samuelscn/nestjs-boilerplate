import { Module } from "@nestjs/common";
import { appConfigFactory } from "./config";
import { ExampleModule } from "./package/example";
import { ConfigModule } from "./package/shared/module/config";
import { LoggerModule } from "./package/shared/module/logger";

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfigFactory] }),
    LoggerModule,
    ExampleModule,
  ],
})
export class AppModule {}
