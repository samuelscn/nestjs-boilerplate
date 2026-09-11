import { ExampleItemEntity } from "../../../persistence/entity/example-item.entity";

export class ExampleItemResponseDto {
  id!: string;
  name!: string;
  createdAt!: Date;

  static fromEntity(entity: ExampleItemEntity): ExampleItemResponseDto {
    return { id: entity.id, name: entity.name, createdAt: entity.createdAt };
  }
}
