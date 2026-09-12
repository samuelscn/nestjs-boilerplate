import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";
import type { Permission } from "./permissions";

export interface Identity {
  readonly userId: string;
}
export interface RequestContext {
  readonly identity: Identity;
  readonly tenant?: { readonly id: string; readonly membershipId: string };
  readonly authorization: {
    readonly roleIds: readonly string[];
    readonly permissions: readonly Permission[];
  };
}

@Injectable()
export class RequestContexts {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  current(): RequestContext {
    const context = this.storage.getStore();
    if (!context) throw new AccessError("forbidden");
    return context;
  }

  run<T>(context: RequestContext, work: () => T): T {
    const immutable = Object.freeze({
      identity: Object.freeze({ ...context.identity }),
      tenant: context.tenant ? Object.freeze({ ...context.tenant }) : undefined,
      authorization: Object.freeze({
        roleIds: Object.freeze([...context.authorization.roleIds]),
        permissions: Object.freeze([...context.authorization.permissions]),
      }),
    });
    return this.storage.run(immutable, work);
  }
}

export class AccessError extends Error {
  constructor(
    readonly code: "forbidden" | "invalid" | "not_found" | "conflict",
  ) {
    super(code);
  }
}
