import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { SecurityPolicyResponseDto, UpdateSecurityPolicyDto } from './dto/security-policy.dto';
import { SecurityPolicyService } from './security-policy.service';

class SecurityPolicySuccessResponseDto extends ApiSuccessResponseDto<SecurityPolicyResponseDto> {}

@ApiTags('Security — Policy')
@ApiBearerAuth('JWT')
@Controller('organizations/:id/security-policy')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Permissions('security.policy.manage')
export class SecurityPolicyController {
  constructor(private readonly securityPolicyService: SecurityPolicyService) {}

  @Get()
  @ApiOperation({
    summary: "Read an organization's security policy (MFA-required, password policy, IP allowlist)",
  })
  @ApiOkResponse({ description: 'Security policy', type: SecurityPolicySuccessResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<SecurityPolicyResponseDto> {
    return this.securityPolicyService.get(id);
  }

  @Patch()
  @ApiOperation({ summary: "Update an organization's security policy" })
  @ApiOkResponse({ description: 'Security policy updated', type: SecurityPolicySuccessResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSecurityPolicyDto,
  ): Promise<SecurityPolicyResponseDto> {
    return this.securityPolicyService.update(id, dto);
  }
}
