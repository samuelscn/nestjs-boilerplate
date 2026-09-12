import {
  DynamicModule,
  Global,
  Module,
  ModuleMetadata,
  Type,
} from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { ApplicationConfig } from "src/config";
import {
  AuthorizationService,
  RequestContexts,
} from "src/package/shared/module/authorization";
import { ConfigService } from "src/package/shared/module/config";
import { TenantDatabase } from "src/package/shared/module/tenant-database";
import { TypeOrmPersistenceModule } from "src/package/shared/module/typeorm";
import { AccessStore } from "./core/contract/access-store";
import { AccessMode } from "./core/model/access.model";
import { AccessService } from "./core/service/access.service";
import { AccessErrorFilter } from "./http/rest/access-error.filter";
import { AccessHttpState } from "./http/rest/access-http-state";
import { AccessInterceptor } from "./http/rest/access.interceptor";
import { AccessController } from "./http/rest/controller/access.controller";
import { TenantController } from "./http/rest/controller/tenant.controller";
import { IdentityProvider } from "./core/contract/identity-provider";
import { FakeIdentityProvider } from "./core/identity/fake-identity.provider";
import { OidcIdentityProvider } from "./core/identity/oidc-identity.provider";
import { PermissionGuard } from "./http/rest/permission.guard";
import {
  HeaderTenantResolver,
  TenantResolver,
} from "./http/rest/tenant-resolver";
import { AccessDatabaseCheck } from "./persistence/access-database-check";
import { accessDataSourceOptions } from "./persistence/access-options";
import { AccessRepository } from "./persistence/repository/access.repository";

@Global()
@Module({})
export class AccessControlModule {
  static forRoot(
    mode: AccessMode,
    adapters: {
      /** Custom provider is useful for product adapters and test doubles. */
      identity?: Type<IdentityProvider>;
      identityProvider?: "fake" | "oidc";
      tenantResolver?: Type<TenantResolver>;
      imports?: ModuleMetadata["imports"];
    } = {},
  ): DynamicModule {
    if (mode !== "single" && mode !== "tenant")
      throw new Error("Invalid authorization mode");
    return {
      module: AccessControlModule,
      imports: [
        ...(adapters.imports ?? []),
        TypeOrmPersistenceModule.forRoot({
          name: "access-control",
          inject: [ConfigService],
          useFactory: (config: ConfigService<ApplicationConfig>) =>
            accessDataSourceOptions(config.get("database"), mode),
        }),
      ],
      controllers: [
        AccessController,
        ...(mode === "tenant" ? [TenantController] : []),
      ],
      providers: [
        AuthorizationService,
        RequestContexts,
        AccessService,
        AccessHttpState,
        {
          provide: IdentityProvider,
          useClass:
            adapters.identity ??
            (adapters.identityProvider === "oidc"
              ? OidcIdentityProvider
              : FakeIdentityProvider),
        },
        {
          provide: TenantResolver,
          useClass: adapters.tenantResolver ?? HeaderTenantResolver,
        },
        {
          provide: TenantDatabase,
          useFactory: (source: DataSource) => new TenantDatabase(source),
          inject: [getDataSourceToken("access-control")],
        },
        {
          provide: AccessStore,
          useFactory: (database: TenantDatabase) =>
            new AccessRepository(mode, database),
          inject: [TenantDatabase],
        },
        {
          provide: AccessDatabaseCheck,
          useFactory: (source: DataSource) =>
            new AccessDatabaseCheck(source, mode),
          inject: [getDataSourceToken("access-control")],
        },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: APP_INTERCEPTOR, useClass: AccessInterceptor },
        { provide: APP_FILTER, useClass: AccessErrorFilter },
      ],
      exports: [
        AccessService,
        AuthorizationService,
        RequestContexts,
        TenantDatabase,
        IdentityProvider,
      ],
    };
  }
}
