import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateExampleItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
