import {
  CanActivate,
  DynamicModule,
  ExecutionContext,
  Global,
  Inject,
  Injectable,
  Module,
  SetMetadata,
} from "@nestjs/common";
import { APP_GUARD, Reflector } from "@nestjs/core";
import { DomainError, ErrorCode } from "../problem";

const FEATURE_FLAG = Symbol("feature-flag");
export const FEATURE_FLAG_VALUES = Symbol("feature-flag-values");

export interface FlagDefinition {
  /** Value that is safe to ship without configuration. */
  readonly default: boolean;
  readonly description: string;
  readonly owner: string;
  /** ISO date by which the flag and its dead branch must be removed. */
  readonly removeBy: string;
}
export type FlagDefinitions = Readonly<Record<string, FlagDefinition>>;

/** `name=true,other=false`; unknown names or values throw, so typos fail at boot. */
export function parseFlags<T extends FlagDefinitions>(
  definitions: T,
  value: string | undefined,
): Record<keyof T, boolean> {
  const flags = Object.fromEntries(
    Object.entries(definitions).map(([name, flag]) => [name, flag.default]),
  ) as Record<keyof T, boolean>;
  for (const entry of (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const [name, raw] = entry.split("=").map((part) => part.trim());
    if (!name || !(name in definitions) || (raw !== "true" && raw !== "false"))
      throw new Error("Invalid feature flag");
    flags[name as keyof T] = raw === "true";
  }
  return flags;
}

@Injectable()
export class FeatureFlags {
  constructor(
    @Inject(FEATURE_FLAG_VALUES)
    private readonly values: Readonly<Record<string, boolean>>,
  ) {}
  isEnabled(name: string): boolean {
    return this.values[name] === true;
  }
}

/** Handler/controller exists only while the flag is on; otherwise 404 before auth. */
export const FeatureFlag = (name: string) => SetMetadata(FEATURE_FLAG, name);

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FeatureFlags,
  ) {}
  canActivate(execution: ExecutionContext): boolean {
    const names = [execution.getClass(), execution.getHandler()]
      .map((target) =>
        this.reflector.get<string | undefined>(FEATURE_FLAG, target),
      )
      .filter((name): name is string => !!name);
    if (names.some((name) => !this.flags.isEnabled(name)))
      throw new DomainError("not_found", ErrorCode.RESOURCE_NOT_FOUND);
    return true;
  }
}

/** Import before other modules that register guards so flags are evaluated first. */
@Global()
@Module({})
export class FeatureFlagsModule {
  static forRoot(values: Readonly<Record<string, boolean>>): DynamicModule {
    return {
      module: FeatureFlagsModule,
      providers: [
        {
          provide: FEATURE_FLAG_VALUES,
          useValue: Object.freeze({ ...values }),
        },
        FeatureFlags,
        { provide: APP_GUARD, useClass: FeatureFlagGuard },
      ],
      exports: [FeatureFlags],
    };
  }
}
