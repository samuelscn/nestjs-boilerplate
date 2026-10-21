export { AccessControlModule } from "./access-control.module";
export { AccessService } from "./core/service/access.service";
export type { Role, Member, AccessMode } from "./core/model/access.model";
export {
  RequirePermission,
  RequireAllPermissions,
  RequireAnyPermission,
  RequireMembership,
} from "./http/rest/permission.decorator";
export {
  IdentityProvider,
  type AuthenticatedIdentity,
  type IdentityCredentials,
} from "./core/contract/identity-provider";
export {
  FakeIdentityProvider,
  FAKE_IDENTITY_TOKENS,
} from "./core/identity/fake-identity.provider";
export { TenantResolver } from "./http/rest/tenant-resolver";
export { accessDatabase } from "./persistence/access-database";
