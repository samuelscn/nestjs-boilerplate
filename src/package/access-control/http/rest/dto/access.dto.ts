import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  MaxLength,
  Min,
  IsString,
  Length,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PERMISSIONS } from "src/package/shared/module/authorization";
import {
  MEMBER_STATUSES,
  type MemberStatus,
} from "../../../core/model/access.model";

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

const toArray = ({ value }: { value: unknown }): unknown[] =>
  value === undefined
    ? []
    : Array.isArray(value)
      ? (value as unknown[])
      : [value];

/** `?q=ana&role=<id>&role=<id>&status=active&page=2&pageSize=20` */
export class MemberQueryDto {
  @ApiPropertyOptional({
    maxLength: 120,
    description: "Name or email contains",
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description: "Any of these roles",
  })
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID("all", { each: true })
  role: string[] = [];
  @ApiPropertyOptional({
    enum: MEMBER_STATUSES,
    enumName: "MemberStatus",
    isArray: true,
  })
  @Transform(toArray)
  @IsArray()
  @IsIn(MEMBER_STATUSES, { each: true })
  status: MemberStatus[] = [];
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 10;
}

export class InvitationDto {
  @ApiProperty({ format: "email", maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  roleId!: string;
}

export class MemberStatusDto {
  @ApiProperty({ enum: ["active", "suspended"] })
  @IsIn(["active", "suspended"])
  status!: "active" | "suspended";
}
