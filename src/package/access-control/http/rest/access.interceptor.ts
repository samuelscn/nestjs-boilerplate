import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { defer, lastValueFrom, Observable } from "rxjs";
import { RequestContexts } from "src/package/shared/module/authorization";
import { AccessService } from "../../core/service/access.service";
import { AccessHttpState } from "./access-http-state";

@Injectable()
export class AccessInterceptor implements NestInterceptor {
  constructor(
    private readonly access: AccessService,
    private readonly contexts: RequestContexts,
    private readonly state: AccessHttpState,
  ) {}
  intercept(
    execution: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    const state = this.state.get(
      execution.switchToHttp().getRequest<Request>(),
    );
    if (!state) throw new ForbiddenException();
    return defer(() => {
      const work = () =>
        lastValueFrom(next.handle(), { defaultValue: undefined });
      if (state.signup) return this.contexts.run(state.context, work);
      if (state.membership)
        return this.access.runAsMember(
          state.context.identity,
          state.context.tenant?.id,
          work,
        );
      return this.access.runAuthorized(
        state.context.identity,
        state.context.tenant?.id,
        state.requirements,
        work,
      );
    });
  }
}
