import { DynamicModule, Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { DEFAULT_PROBLEM_TYPE_BASE } from "./problem-details";
import {
  PROBLEM_OPTIONS,
  ProblemExceptionFilter,
  ProblemOptions,
} from "./problem-exception.filter";
import { createValidationPipe } from "./validation";

/** Installs the global error contract: Problem Details filter and DTO validation pipe. */
@Global()
@Module({})
export class ProblemModule {
  static forRoot(options: Partial<ProblemOptions> = {}): DynamicModule {
    return {
      module: ProblemModule,
      providers: [
        {
          provide: PROBLEM_OPTIONS,
          useValue: {
            typeBase: options.typeBase ?? DEFAULT_PROBLEM_TYPE_BASE,
          } satisfies ProblemOptions,
        },
        { provide: APP_FILTER, useClass: ProblemExceptionFilter },
        { provide: APP_PIPE, useFactory: createValidationPipe },
      ],
    };
  }
}
