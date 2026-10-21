import {
  Check,
  Column,
  Entity,
  ForeignKey,
  Index,
  PrimaryColumn,
} from "typeorm";
import { AccessRecord } from "./access-record";
import { PermissionEntity } from "./permission.entity";
import type { MemberStatus } from "../../core/model/access.model";

@Entity("access_identity_user")
@Check(`"status" IN ('invited', 'active', 'suspended')`)
@Check(`("status" = 'invited') = ("identityUserId" IS NULL)`)
@Index(["email"], { unique: true, where: '"email" IS NOT NULL' })
export class IdentityUserEntity extends AccessRecord {
  @Column({ type: "varchar", length: 255, unique: true, nullable: true })
  identityUserId!: string | null;
  /** Pending invitations have no identity until the invitee signs in with the verified email. */
  @Column({ type: "varchar", length: 254, nullable: true }) email!:
    | string
    | null;
  @Column({ type: "varchar", length: 120, nullable: true }) displayName!:
    | string
    | null;
  @Column({ type: "varchar", length: 16, default: "active" })
  status!: MemberStatus;
  @Column({ type: "timestamptz", nullable: true }) lastSeenAt!: Date | null;
  @Column({ type: "timestamptz", nullable: true })
  profileSyncedAt!: Date | null;
}

@Entity("access_role")
export class SingleRoleEntity extends AccessRecord {
  @Column({ type: "varchar", length: 120 }) name!: string;
  @Column({ type: "varchar", length: 80, unique: true }) slug!: string;
  @Column({ type: "varchar", length: 500, nullable: true }) description!:
    | string
    | null;
  @Column({ default: false }) isSystem!: boolean;
}

@Entity("access_role_permission")
@ForeignKey(() => SingleRoleEntity, ["roleId"], ["id"], { onDelete: "CASCADE" })
@ForeignKey(() => PermissionEntity, ["permissionId"], ["id"], {
  onDelete: "RESTRICT",
})
export class SingleRolePermissionEntity {
  @PrimaryColumn("uuid") roleId!: string;
  @PrimaryColumn({ type: "varchar", length: 100 }) permissionId!: string;
}

@Entity("access_role_assignment")
@ForeignKey(() => IdentityUserEntity, ["memberId"], ["id"], {
  onDelete: "CASCADE",
})
@ForeignKey(() => SingleRoleEntity, ["roleId"], ["id"], { onDelete: "CASCADE" })
@Index(["roleId"])
export class SingleRoleAssignmentEntity {
  @PrimaryColumn("uuid") memberId!: string;
  @PrimaryColumn("uuid") roleId!: string;
}

@Entity("access_audit")
export class SingleAuditEntity extends AccessRecord {
  @Column({ type: "varchar", length: 50 }) event!: string;
  @Column({ type: "varchar", length: 255 }) actorId!: string;
  @Column({ type: "varchar", length: 255 }) targetId!: string;
}

// One immutable singleton serializes provisioning and RBAC changes in single mode.
@Entity("access_lock")
export class AccessLockEntity {
  @PrimaryColumn({ type: "varchar", length: 30 }) name!: string;
}

export const SINGLE_ENTITIES = [
  PermissionEntity,
  IdentityUserEntity,
  SingleRoleEntity,
  SingleRolePermissionEntity,
  SingleRoleAssignmentEntity,
  SingleAuditEntity,
  AccessLockEntity,
];
