import { DynamicModule, Global } from "@nestjs/common";
import {
  ConfigModule as NestConfigModule,
  ConfigModuleOptions as NestConfigModuleOptions,
} from "@nestjs/config";

import { ConfigService } from "./service/config.service";
import { sharedConfigFactory } from "./util/shared.config";
@Global()
//testing config
export class ConfigModule {
  static forRoot(options?: NestConfigModuleOptions): DynamicModule {
    return {
      module: ConfigModule,
      imports: [
        NestConfigModule.forRoot({
          ...options,
          // See https://docs.nestjs.com/techniques/configuration#expandable-variables
          expandVariables: true,
          load: [sharedConfigFactory, ...(options?.load ?? [])],
        }),
      ],
      providers: [ConfigService],
      exports: [ConfigService],
    };
  }
}
