import { ApiProperty } from "@nestjs/swagger";
import {
  PERMISSIONS,
  type Permission,
} from "src/package/shared/module/authorization";
import type { Member, Role } from "../../../core/model/access.model";

export class RoleResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  /** System roles (owner, admin, member) cannot be edited or deleted. */
  @ApiProperty() isSystem!: boolean;
  @ApiProperty({ enum: PERMISSIONS, enumName: "Permission", isArray: true })
  permissions!: Permission[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  static from(role: Role): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      isSystem: role.isSystem,
      permissions: [...role.permissions],
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}

export class MemberResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  /** `sub` of the user in the identity provider. */
  @ApiProperty() identityUserId!: string;
  @ApiProperty({ type: [String], format: "uuid" }) roleIds!: string[];

  static from(member: Member): MemberResponseDto {
    return {
      id: member.id,
      identityUserId: member.identityUserId,
      roleIds: [...member.roleIds],
    };
  }
}

export class TenantCreatedResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
}
