import { DynamicModule, Module } from "@nestjs/common";
import {
  getDataSourceToken,
  TypeOrmModule,
  TypeOrmModuleAsyncOptions,
} from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { TypeOrmTransactionManager } from "./service/typeorm-transaction-manager.service";

@Module({})
export class TypeOrmPersistenceModule {
  static forRoot(options: TypeOrmModuleAsyncOptions): DynamicModule {
    return {
      module: TypeOrmPersistenceModule,
      imports: [TypeOrmModule.forRootAsync(options)],
      providers: [
        {
          provide: TypeOrmTransactionManager,
          useFactory: (dataSource: DataSource) =>
            new TypeOrmTransactionManager(dataSource),
          inject: [getDataSourceToken(options.name)],
        },
      ],
      exports: [TypeOrmTransactionManager],
    };
  }
}
