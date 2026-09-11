import { Body, Controller, Get, Post } from "@nestjs/common";
import { ExampleService } from "../../../core/service/example.service";
import { CreateExampleItemDto } from "../dto/create-example-item.dto";
import { ExampleItemResponseDto } from "../dto/example-item-response.dto";

@Controller("examples")
export class ExampleController {
  constructor(private readonly service: ExampleService) {}

  @Post()
  async create(
    @Body() input: CreateExampleItemDto,
  ): Promise<ExampleItemResponseDto> {
    return ExampleItemResponseDto.fromEntity(await this.service.create(input));
  }

  @Get()
  async list(): Promise<ExampleItemResponseDto[]> {
    const items = await this.service.list();
    return items.map((item) => ExampleItemResponseDto.fromEntity(item));
  }
}
