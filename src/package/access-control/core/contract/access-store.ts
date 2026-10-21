import type {
  Identity,
  RequestContext,
} from "src/package/shared/module/authorization";
import type {
  AccessMode,
  AuditEvent,
  Member,
  MemberPage,
  MemberQuery,
  MemberStatus,
  Role,
  RoleInput,
  TenantInput,
} from "../model/access.model";

/** Persistence port: no ORM or HTTP types cross this boundary. */
export abstract class AccessStore {
  abstract readonly mode: AccessMode;
  abstract transaction<T>(
    scope: string | undefined,
    work: () => Promise<T>,
  ): Promise<T>;
  abstract lockScope(): Promise<void>;
  abstract loadContext(identity: Identity): Promise<RequestContext | null>;
  abstract createTenant(id: string, input: TenantInput): Promise<void>;
  abstract listRoles(): Promise<Role[]>;
  abstract findRole(id: string): Promise<Role | null>;
  abstract saveRole(
    input: RoleInput,
    system?: boolean,
    id?: string,
  ): Promise<Role>;
  abstract deleteRole(id: string): Promise<void>;
  abstract listMembers(): Promise<Member[]>;
  abstract findMember(id: string): Promise<Member | null>;
  abstract createMember(identityUserId: string): Promise<Member>;
  abstract listMembersPage(query: MemberQuery): Promise<MemberPage>;
  abstract findMemberByIdentity(identityUserId: string): Promise<Member | null>;
  abstract inviteMember(email: string): Promise<Member>;
  /** Binds a pending invitation to the identity that proved the email. */
  abstract claimInvitation(
    identityUserId: string,
    email: string,
  ): Promise<boolean>;
  abstract updateMemberStatus(id: string, status: MemberStatus): Promise<void>;
  abstract updateProfile(
    id: string,
    profile: {
      displayName?: string | null;
      email?: string | null;
      lastSeenAt?: Date;
      profileSyncedAt?: Date;
    },
  ): Promise<void>;
  abstract deleteMember(id: string): Promise<void>;
  abstract assignRole(memberId: string, roleId: string): Promise<void>;
  abstract unassignRole(memberId: string, roleId: string): Promise<void>;
  abstract countOwners(): Promise<number>;
  abstract audit(
    event: AuditEvent,
    actorId: string,
    targetId: string,
  ): Promise<void>;
}
