import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import {
  AccessError,
  AuthorizationService,
  PermissionRequirement,
} from "src/package/shared/module/authorization";
import { AccessService } from "../../core/service/access.service";
import { AccessHttpState } from "./access-http-state";
import { IdentityProvider } from "../../core/contract/identity-provider";
import { bearerIdentityCredentials } from "./bearer-identity-credentials";
import {
  IDENTITY_ONLY,
  MEMBERSHIP_ONLY,
  PERMISSION_REQUIREMENT,
} from "./permission.decorator";
import { TenantResolver } from "./tenant-resolver";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly identityProvider: IdentityProvider,
    private readonly tenants: TenantResolver,
    private readonly access: AccessService,
    private readonly authorization: AuthorizationService,
    private readonly state: AccessHttpState,
  ) {}

  async canActivate(execution: ExecutionContext): Promise<boolean> {
    if (execution.getType() !== "http") throw new ForbiddenException();
    const request = execution.switchToHttp().getRequest<Request>();
    const credentials = bearerIdentityCredentials(request);
    const identity = credentials
      ? await this.identityProvider.authenticate(credentials)
      : null;
    if (
      !identity ||
      typeof identity.userId !== "string" ||
      !identity.userId.trim() ||
      identity.userId.length > 255
    )
      throw new UnauthorizedException();
    const requirements = [execution.getClass(), execution.getHandler()]
      .map((target) =>
        this.reflector.get<PermissionRequirement | undefined>(
          PERMISSION_REQUIREMENT,
          target,
        ),
      )
      .filter((value): value is PermissionRequirement => !!value);
    const signup =
      this.reflector.get<boolean>(IDENTITY_ONLY, execution.getHandler()) ===
      true;
    if (signup && this.access.mode === "tenant" && !requirements.length) {
      if (request.headers["x-tenant-id"] !== undefined)
        throw new ForbiddenException();
      this.state.set(request, {
        context: { identity, authorization: { roleIds: [], permissions: [] } },
        requirements,
        signup,
      });
      return true;
    }
    const membership =
      this.reflector.get<boolean>(MEMBERSHIP_ONLY, execution.getHandler()) ===
      true;
    if (signup || (!requirements.length && !membership))
      throw new ForbiddenException();
    if (
      this.access.mode === "single" &&
      request.headers["x-tenant-id"] !== undefined
    )
      throw new ForbiddenException();
    const tenantId =
      this.access.mode === "tenant" ? this.tenants.resolve(request) : undefined;
    try {
      const context = await this.access.resolve(identity, tenantId);
      if (
        !requirements.every((requirement) =>
          this.authorization.allows(context, requirement),
        )
      )
        throw new ForbiddenException();
      this.state.set(request, {
        context,
        requirements,
        signup: false,
        membership: membership && !requirements.length,
      });
      return true;
    } catch (error) {
      if (error instanceof AccessError) throw new ForbiddenException();
      throw error;
    }
  }
}
