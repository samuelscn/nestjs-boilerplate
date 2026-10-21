import { ApiProperty } from "@nestjs/swagger";
import { ExampleItemEntity } from "../../../persistence/entity/example-item.entity";

export class ExampleItemResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() createdAt!: Date;

  static fromEntity(entity: ExampleItemEntity): ExampleItemResponseDto {
    return { id: entity.id, name: entity.name, createdAt: entity.createdAt };
  }
}
