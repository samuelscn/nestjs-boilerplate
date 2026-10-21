import { ApiProperty } from "@nestjs/swagger";
import {
  PERMISSIONS,
  type Permission,
} from "src/package/shared/module/authorization";
import {
  MEMBER_STATUSES,
  type Member,
  type MemberPage,
  type MemberStatus,
  type Role,
} from "../../../core/model/access.model";

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
  /** `sub` of the user in the identity provider; null while the invitation is pending. */
  @ApiProperty({ type: String, nullable: true }) identityUserId!: string | null;
  @ApiProperty({ type: String, nullable: true }) displayName!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ enum: MEMBER_STATUSES, enumName: "MemberStatus" })
  status!: MemberStatus;
  @ApiProperty({ type: Date, nullable: true }) lastSeenAt!: Date | null;
  @ApiProperty({ type: [String], format: "uuid" }) roleIds!: string[];

  static from(member: Member): MemberResponseDto {
    return {
      id: member.id,
      identityUserId: member.identityUserId,
      displayName: member.displayName,
      email: member.email,
      status: member.status,
      lastSeenAt: member.lastSeenAt,
      roleIds: [...member.roleIds],
    };
  }
}

export class MemberPageResponseDto {
  @ApiProperty({ type: [MemberResponseDto] }) items!: MemberResponseDto[];
  @ApiProperty() total!: number;
  /** Clamped to the last page when the requested one no longer exists. */
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;

  static from(page: MemberPage): MemberPageResponseDto {
    return {
      items: page.items.map((member) => MemberResponseDto.from(member)),
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}

export class TenantCreatedResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
}

export class MyAccessResponseDto {
  /** `sub` of the caller in the identity provider. */
  @ApiProperty() userId!: string;
  @ApiProperty({ type: [String], format: "uuid" }) roleIds!: string[];
  /** Effective permissions; use only to adapt the UI, the API authorizes every call. */
  @ApiProperty({ enum: PERMISSIONS, enumName: "Permission", isArray: true })
  permissions!: Permission[];
}

export class PermissionGroupDto {
  @ApiProperty({ example: "member" }) resource!: string;
  @ApiProperty({ enum: PERMISSIONS, enumName: "Permission", isArray: true })
  permissions!: Permission[];
}

export class PermissionCatalogResponseDto {
  @ApiProperty({ type: [PermissionGroupDto] }) groups!: PermissionGroupDto[];

  static fromCatalog(
    catalog: Readonly<Record<string, Readonly<Record<string, Permission>>>>,
  ): PermissionCatalogResponseDto {
    return {
      groups: Object.entries(catalog).map(([resource, actions]) => ({
        resource,
        permissions: Object.values(actions),
      })),
    };
  }
}
