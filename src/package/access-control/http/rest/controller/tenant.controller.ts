import { Body, Controller, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiTags } from "@nestjs/swagger";
import { AccessService } from "../../../core/service/access.service";
import { TenantDto } from "../dto/access.dto";
import { TenantCreatedResponseDto } from "../dto/access-response.dto";
import { AuthenticatedTenantSignup } from "../permission.decorator";

@ApiTags("tenants")
@Controller("tenants")
export class TenantController {
  constructor(private readonly access: AccessService) {}
  @Post()
  @ApiCreatedResponse({ type: TenantCreatedResponseDto })
  @AuthenticatedTenantSignup()
  create(@Body() body: TenantDto): Promise<TenantCreatedResponseDto> {
    return this.access.createTenant(body);
  }
}
