import {
  Column,
  Entity,
  ForeignKey,
  Index,
  PrimaryColumn,
  Unique,
} from "typeorm";
import { AccessRecord } from "./access-record";
import { PermissionEntity } from "./permission.entity";

@Entity("access_tenant")
export class TenantEntity extends AccessRecord {
  @Column({ type: "varchar", length: 120 }) name!: string;
  @Column({ type: "varchar", length: 80, unique: true }) slug!: string;
}

@Entity("access_membership")
@Unique(["tenantId", "identityUserId"])
@Unique(["tenantId", "id"])
@ForeignKey(() => TenantEntity, ["tenantId"], ["id"], { onDelete: "RESTRICT" })
export class MembershipEntity extends AccessRecord {
  @Column("uuid") tenantId!: string;
  @Column({ type: "varchar", length: 255 }) identityUserId!: string;
}

@Entity("access_role")
@Unique(["tenantId", "slug"])
@Unique(["tenantId", "id"])
@ForeignKey(() => TenantEntity, ["tenantId"], ["id"], { onDelete: "RESTRICT" })
export class TenantRoleEntity extends AccessRecord {
  @Column("uuid") tenantId!: string;
  @Column({ type: "varchar", length: 120 }) name!: string;
  @Column({ type: "varchar", length: 80 }) slug!: string;
  @Column({ type: "varchar", length: 500, nullable: true }) description!:
    | string
    | null;
  @Column({ default: false }) isSystem!: boolean;
}

@Entity("access_role_permission")
@ForeignKey(
  () => TenantRoleEntity,
  ["tenantId", "roleId"],
  ["tenantId", "id"],
  { onDelete: "CASCADE" },
)
@ForeignKey(() => PermissionEntity, ["permissionId"], ["id"], {
  onDelete: "RESTRICT",
})
export class TenantRolePermissionEntity {
  @PrimaryColumn("uuid") tenantId!: string;
  @PrimaryColumn("uuid") roleId!: string;
  @PrimaryColumn({ type: "varchar", length: 100 }) permissionId!: string;
}

@Entity("access_role_assignment")
@ForeignKey(
  () => MembershipEntity,
  ["tenantId", "memberId"],
  ["tenantId", "id"],
  { onDelete: "CASCADE" },
)
@ForeignKey(
  () => TenantRoleEntity,
  ["tenantId", "roleId"],
  ["tenantId", "id"],
  { onDelete: "CASCADE" },
)
@Index(["tenantId", "roleId"])
export class TenantRoleAssignmentEntity {
  @PrimaryColumn("uuid") tenantId!: string;
  @PrimaryColumn("uuid") memberId!: string;
  @PrimaryColumn("uuid") roleId!: string;
}

@Entity("access_audit")
@Index(["tenantId", "createdAt"])
@ForeignKey(() => TenantEntity, ["tenantId"], ["id"], { onDelete: "RESTRICT" })
export class TenantAuditEntity extends AccessRecord {
  @Column("uuid") tenantId!: string;
  @Column({ type: "varchar", length: 50 }) event!: string;
  @Column({ type: "varchar", length: 255 }) actorId!: string;
  @Column({ type: "varchar", length: 255 }) targetId!: string;
}

export const TENANT_ENTITIES = [
  PermissionEntity,
  TenantEntity,
  MembershipEntity,
  TenantRoleEntity,
  TenantRolePermissionEntity,
  TenantRoleAssignmentEntity,
  TenantAuditEntity,
];
