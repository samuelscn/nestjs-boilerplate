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
import { PERMISSIONS } from "src/package/shared/module/authorization";

export class TenantDto {
  @IsString() @Length(1, 120) @Matches(/\S/) name!: string;
  @IsString() @Length(1, 80) @Matches(/^[a-z][a-z0-9-]*$/) slug!: string;
}
export class RoleDto extends TenantDto {
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsIn(PERMISSIONS, { each: true })
  permissions!: string[];
}
export class MemberDto {
  @IsString() @Length(1, 255) @Matches(/\S/) identityUserId!: string;
}
