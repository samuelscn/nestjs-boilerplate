import { ExampleService } from "../../core/service/example.service";
import { ExampleItemEntity } from "../../persistence/entity/example-item.entity";
import { ExampleItemRepository } from "../../persistence/repository/example-item.repository";

describe("ExampleService", () => {
  const repository = { save: jest.fn(), findAllNewestFirst: jest.fn() };
  const service = new ExampleService(
    repository as unknown as ExampleItemRepository,
  );

  beforeEach(() => jest.clearAllMocks());

  it("creates an item through the repository", async () => {
    repository.save.mockImplementation((item: ExampleItemEntity) =>
      Promise.resolve(item),
    );
    const result = await service.create({ name: "Reference item" });
    expect(result.name).toBe("Reference item");
    expect(repository.save).toHaveBeenCalledWith(expect.any(ExampleItemEntity));
  });

  it("returns the ordered repository result", async () => {
    const items = [new ExampleItemEntity({ name: "Newest" })];
    repository.findAllNewestFirst.mockResolvedValue(items);
    await expect(service.list()).resolves.toBe(items);
  });
});
