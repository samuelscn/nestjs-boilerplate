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
import { Permission } from "src/package/shared/module/authorization";
import { AccessService } from "../../../core/service/access.service";
import { MemberDto, RoleDto } from "../dto/access.dto";
import { RequirePermission } from "../permission.decorator";

@Controller("access")
export class AccessController {
  constructor(private readonly access: AccessService) {}
  @Get("roles")
  @RequirePermission(Permission.role.read)
  listRoles() {
    return this.access.listRoles();
  }
  @Post("roles")
  @RequirePermission(Permission.role.create)
  createRole(@Body() body: RoleDto) {
    return this.access.createRole(body);
  }
  @Put("roles/:id")
  @RequirePermission(Permission.role.update)
  updateRole(@Param("id", ParseUUIDPipe) id: string, @Body() body: RoleDto) {
    return this.access.updateRole(id, body);
  }
  @Delete("roles/:id")
  @HttpCode(204)
  @RequirePermission(Permission.role.delete)
  deleteRole(@Param("id", ParseUUIDPipe) id: string) {
    return this.access.deleteRole(id);
  }
  @Get("members")
  @RequirePermission(Permission.member.read)
  listMembers() {
    return this.access.listMembers();
  }
  @Post("members")
  @RequirePermission(Permission.member.invite)
  createMember(@Body() body: MemberDto) {
    return this.access.createMember(body.identityUserId);
  }
  @Delete("members/:id")
  @HttpCode(204)
  @RequirePermission(Permission.member.remove)
  removeMember(@Param("id", ParseUUIDPipe) id: string) {
    return this.access.removeMember(id);
  }
  @Put("members/:memberId/roles/:roleId")
  @HttpCode(204)
  @RequirePermission(Permission.role.assign)
  assignRole(
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ) {
    return this.access.assignRole(memberId, roleId);
  }
  @Delete("members/:memberId/roles/:roleId")
  @HttpCode(204)
  @RequirePermission(Permission.role.assign)
  unassignRole(
    @Param("memberId", ParseUUIDPipe) memberId: string,
    @Param("roleId", ParseUUIDPipe) roleId: string,
  ) {
    return this.access.unassignRole(memberId, roleId);
  }
}
