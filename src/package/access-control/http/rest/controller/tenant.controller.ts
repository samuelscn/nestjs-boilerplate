import { Body, Controller, Post } from "@nestjs/common";
import { AccessService } from "../../../core/service/access.service";
import { TenantDto } from "../dto/access.dto";
import { AuthenticatedTenantSignup } from "../permission.decorator";

@Controller("tenants")
export class TenantController {
  constructor(private readonly access: AccessService) {}
  @Post()
  @AuthenticatedTenantSignup()
  create(@Body() body: TenantDto) {
    return this.access.createTenant(body);
  }
}
