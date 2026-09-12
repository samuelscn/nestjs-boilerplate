import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/** RBAC uses explicit hard deletion; never inherits the unfinished soft-delete policy. */
export abstract class AccessRecord {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @CreateDateColumn({ type: "timestamptz" }) createdAt!: Date;
  @UpdateDateColumn({ type: "timestamptz" }) updatedAt!: Date;
}
