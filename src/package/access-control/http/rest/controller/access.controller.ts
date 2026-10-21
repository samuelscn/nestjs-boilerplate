import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Permission } from "src/package/shared/module/authorization";
import { AccessService } from "../../../core/service/access.service";
import { MemberDto, RoleDto } from "../dto/access.dto";
import { MemberResponseDto, RoleResponseDto } from "../dto/access-response.dto";
import { RequirePermission } from "../permission.decorator";

@ApiTags("access")
@Controller("access")
export class AccessController {
  constructor(private readonly access: AccessService) {}
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
  @ApiOkResponse({ type: [MemberResponseDto] })
  @RequirePermission(Permission.member.read)
  async listMembers(): Promise<MemberResponseDto[]> {
    return (await this.access.listMembers()).map((member) =>
      MemberResponseDto.from(member),
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
