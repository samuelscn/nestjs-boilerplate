import { DataSource } from "typeorm";
import { ExampleItemEntity } from "../../persistence/entity/example-item.entity";
import { ExampleItemRepository } from "../../persistence/repository/example-item.repository";

describe("ExampleItemRepository", () => {
  let dataSource: DataSource;
  let repository: ExampleItemRepository;

  beforeAll(async () => {
    dataSource = await new DataSource({
      type: "postgres",
      host: process.env.DATABASE_HOST,
      port: Number(process.env.DATABASE_PORT),
      username: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      entities: [ExampleItemEntity],
      synchronize: true,
      dropSchema: true,
    }).initialize();
    repository = new ExampleItemRepository(dataSource);
  });

  afterAll(async () => dataSource.destroy());

  it("persists and retrieves newest items first", async () => {
    const older = await repository.save(
      new ExampleItemEntity({
        name: "Older",
        createdAt: new Date("2020-01-01"),
      }),
    );
    const newer = await repository.save(
      new ExampleItemEntity({
        name: "Newer",
        createdAt: new Date("2021-01-01"),
      }),
    );
    const result = await repository.findAllNewestFirst();
    expect(result.map((item) => item.id)).toEqual([newer.id, older.id]);
  });
});
