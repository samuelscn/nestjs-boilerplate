import { Module } from "@nestjs/common";
import { appConfigFactory } from "./config";
import { AccessControlModule } from "./package/access-control";
import { ExampleModule } from "./package/example";
import { ConfigModule } from "./package/shared/module/config";
import { LoggerModule } from "./package/shared/module/logger";
import { ProblemModule } from "./package/shared/module/problem";
import { FeatureFlagsModule } from "./package/shared/module/feature-flags";

@Module({
  imports: [
    ConfigModule.forRoot({ load: [appConfigFactory] }),
    LoggerModule,
    ProblemModule.forRoot({ typeBase: appConfigFactory().problem.typeBase }),
    FeatureFlagsModule.forRoot(appConfigFactory().featureFlags),
    AccessControlModule.forRoot(appConfigFactory().authorization.mode, {
      identityProvider: appConfigFactory().identity.provider,
    }),
    ...(appConfigFactory().authorization.mode === "single"
      ? [ExampleModule]
      : []),
  ],
})
export class AppModule {}
