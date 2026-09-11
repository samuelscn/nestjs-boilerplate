import { Injectable } from "@nestjs/common";
import { ExampleItemEntity } from "../../persistence/entity/example-item.entity";
import { ExampleItemRepository } from "../../persistence/repository/example-item.repository";

export interface CreateExampleItem {
  name: string;
}

@Injectable()
export class ExampleService {
  constructor(private readonly repository: ExampleItemRepository) {}

  async create(input: CreateExampleItem): Promise<ExampleItemEntity> {
    return this.repository.save(new ExampleItemEntity({ name: input.name }));
  }

  async list(): Promise<ExampleItemEntity[]> {
    return this.repository.findAllNewestFirst();
  }
}
