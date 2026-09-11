import {
  BeforeInsert,
  BeforeUpdate,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";

/**
 * Do not extend TypeORM's BaseEntity to avoid coupling with TypeORM
 */
export abstract class DefaultEntity {
  constructor() {
    this.id = uuidv7();
  }
  @BeforeInsert()
  beforeInsert(): void {
    this.createdAt = this.createdAt || new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  beforeUpdate(): void {
    this.updatedAt = new Date();
  }

  @PrimaryColumn({ type: "uuid" })
  id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  //TODO add soft remove
  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;
}
