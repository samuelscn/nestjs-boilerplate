import { Column, Entity } from "typeorm";
import { DefaultEntity } from "src/package/shared/module/typeorm";

@Entity({ name: "example_item" })
export class ExampleItemEntity extends DefaultEntity {
  constructor(data: Partial<ExampleItemEntity> = {}) {
    super();
    Object.assign(this, data);
  }

  @Column({ type: "varchar", length: 120 })
  name!: string;
}
