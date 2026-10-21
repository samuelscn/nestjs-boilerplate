import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PERMISSIONS } from "src/package/shared/module/authorization";

export class TenantDto {
  @ApiProperty({ minLength: 1, maxLength: 120 })
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  name!: string;
  @ApiProperty({ minLength: 1, maxLength: 80, pattern: "^[a-z][a-z0-9-]*$" })
  @IsString()
  @Length(1, 80)
  @Matches(/^[a-z][a-z0-9-]*$/)
  slug!: string;
}
export class RoleDto extends TenantDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
  @ApiProperty({ type: [String], enum: PERMISSIONS, enumName: "Permission" })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissions!: string[];
}
export class MemberDto {
  @ApiProperty({ description: "`sub` of the user in the identity provider." })
  @IsString()
  @Length(1, 255)
  @Matches(/\S/)
  identityUserId!: string;
}
