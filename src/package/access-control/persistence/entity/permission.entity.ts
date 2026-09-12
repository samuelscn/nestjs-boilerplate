import { Entity, PrimaryColumn } from "typeorm";

@Entity("access_permission")
export class PermissionEntity {
  @PrimaryColumn({ type: "varchar", length: 100 }) id!: string;
}
