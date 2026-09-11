import { Module } from "@nestjs/common";
import { ExampleService } from "./core/service/example.service";
import { ExampleController } from "./http/rest/controller/example.controller";
import { ExamplePersistenceModule } from "./persistence/example-persistence.module";

@Module({
  imports: [ExamplePersistenceModule],
  controllers: [ExampleController],
  providers: [ExampleService],
  exports: [ExampleService],
})
export class ExampleModule {}
