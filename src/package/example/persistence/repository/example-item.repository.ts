import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { DefaultTypeOrmRepository } from "src/package/shared/module/typeorm";
import { ExampleItemEntity } from "../entity/example-item.entity";

@Injectable()
export class ExampleItemRepository extends DefaultTypeOrmRepository<ExampleItemEntity> {
  constructor(@InjectDataSource("example") dataSource: DataSource) {
    super(ExampleItemEntity, dataSource.manager);
  }

  async findAllNewestFirst(): Promise<ExampleItemEntity[]> {
    return this.find({ order: { createdAt: "DESC" } });
  }
}
