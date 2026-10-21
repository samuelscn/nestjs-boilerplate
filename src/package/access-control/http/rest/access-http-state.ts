import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import type {
  PermissionRequirement,
  RequestContext,
} from "src/package/shared/module/authorization";

@Injectable()
export class AccessHttpState {
  private readonly requests = new WeakMap<
    Request,
    {
      context: RequestContext;
      requirements: PermissionRequirement[];
      signup: boolean;
      membership?: boolean;
    }
  >();
  set(
    request: Request,
    value: {
      context: RequestContext;
      requirements: PermissionRequirement[];
      signup: boolean;
      membership?: boolean;
    },
  ): void {
    this.requests.set(request, value);
  }
  get(request: Request) {
    return this.requests.get(request);
  }
}
