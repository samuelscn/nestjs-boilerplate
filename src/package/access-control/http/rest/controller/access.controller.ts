import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Permission } from "src/package/shared/module/authorization";
import { AccessService } from "../../../core/service/access.service";
import {
  InvitationDto,
  MemberDto,
  MemberQueryDto,
  MemberStatusDto,
  RoleDto,
} from "../dto/access.dto";
import { bearerIdentityCredentials } from "../bearer-identity-credentials";
import {
  MemberPageResponseDto,
  MemberResponseDto,
  MyAccessResponseDto,
  PermissionCatalogResponseDto,
  RoleResponseDto,
} from "../dto/access-response.dto";
import {
  RequireAllPermissions,
  RequireMembership,
  RequirePermission,
} from "../permission.decorator";

@ApiTags("access")
@Controller("access")
export class AccessController {
  constructor(private readonly access: AccessService) {}
  @Get("me")
  @RequireMembership()
  @ApiOkResponse({ type: MyAccessResponseDto })
  async me(@Req() request: Request): Promise<MyAccessResponseDto> {
    const access = await this.access.myAccess(
      bearerIdentityCredentials(request) ?? undefined,
    );
    return {
      userId: access.userId,
      roleIds: [...access.roleIds],
      permissions: [...access.permissions],
    };
  }
  @Get("permissions")
  @RequirePermission(Permission.role.read)
  @ApiOkResponse({ type: PermissionCatalogResponseDto })
  permissions(): PermissionCatalogResponseDto {
    return PermissionCatalogResponseDto.fromCatalog(Permission);
  }
  @Get("roles")
  @ApiOkResponse({ type: [RoleResponseDto] })
  @RequirePermission(Permission.role.read)
  async listRoles(): Promise<RoleResponseDto[]> {
    return (await this.access.listRoles()).map((role) =>
      RoleResponseDto.from(role),
    );
  }
  @Post("roles")
  @ApiCreatedResponse({ type: RoleResponseDto })
  @RequirePermission(Permission.role.create)
  async createRole(@Body() body: RoleDto): Promise<RoleResponseDto> {
    return RoleResponseDto.from(await this.access.createRole(body));
  }
  @Put("roles/:id")
  @ApiOkResponse({ type: RoleResponseDto })
  @RequirePermission(Permission.role.update)
  async updateRole(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: RoleDto,
  ): Promise<RoleResponseDto> {
    return RoleResponseDto.from(await this.access.updateRole(id, body));
  }
  @Delete("roles/:id")
  @HttpCode(204)
  @ApiNoContentResponse()
  @RequirePermission(Permission.role.delete)
  deleteRole(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.access.deleteRole(id);
  }
  @Get("members")
  @ApiOkResponse({ type: MemberPageResponseDto })
  @RequirePermission(Permission.member.read)
  async listMembers(
    @Query() query: MemberQueryDto,
  ): Promise<MemberPageResponseDto> {
    return MemberPageResponseDto.from(
      await this.access.listMembersPage({
        q: query.q?.trim() ?? "",
        roleIds: query.role,
        statuses: query.status,
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  }
  @Post("members/invitations")
  @ApiCreatedResponse({ type: MemberResponseDto })
  @RequireAllPermissions(Permission.member.invite, Permission.role.assign)
  async invite(@Body() body: InvitationDto): Promise<MemberResponseDto> {
    return MemberResponseDto.from(
      await this.access.inviteMember(body.email, body.roleId),
    );
  }
  @Patch("members/:id/status")
  @ApiOkResponse({ type: MemberResponseDto })
  @RequirePermission(Permission.member.update)
  async setStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: MemberStatusDto,
  ): Promise<MemberResponseDto> {
    return MemberResponseDto.from(
      await this.access.setMemberStatus(id, body.status),
    );
  }
  @Post("members")
  @ApiCreatedResponse({ type: MemberResponseDto })
  @RequirePermission(Permission.member.invite)
  async createMember(@Body() body: MemberDto): Promise<MemberResponseDto> {
    return MemberResponseDto.from(
      await this.access.createMember(body.identityUserId),
    );
  }
  @Delete("members/:id")
  @HttpCode(204)
  @ApiNoContentResponse()
  @RequirePermission(Permission.member.remove)
  removeMember(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.access.removeMember(id);
  }
  @Put("members/:memberId/roles/:roleId")
  @HttpCode(204)
  @ApiNoContentResponse()
  @RequirePermission(Permission.role.assign)
  assignRole(
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.access.assignRole(memberId, roleId);
  }
  @Delete("members/:memberId/roles/:roleId")
  @HttpCode(204)
  @ApiNoContentResponse()
  @RequirePermission(Permission.role.assign)
  unassignRole(
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    return this.access.unassignRole(memberId, roleId);
  }
}
