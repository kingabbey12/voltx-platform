import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  DeveloperConnectStatusResponseDto,
  OnboardingLinkResponseDto,
} from './dto/developer-connect.dto';
import { DeveloperConnectService } from './developer-connect.service';

class OnboardingLinkSuccessResponseDto extends ApiSuccessResponseDto<OnboardingLinkResponseDto> {}
class DeveloperConnectStatusSuccessResponseDto extends ApiSuccessResponseDto<DeveloperConnectStatusResponseDto> {}

/** Reuses `marketplace.app.manage` — Connect onboarding is part of being
 * able to sell an app, not a separate permission surface. */
@ApiTags('Developer Platform — Marketplace Stripe Connect')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/marketplace/connect')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class DeveloperConnectController {
  constructor(private readonly service: DeveloperConnectService) {}

  @Post('onboarding-link')
  @Permissions('marketplace.app.manage')
  @ApiOperation({ summary: 'Create (or continue) a Stripe Connect Express onboarding link' })
  @ApiCreatedResponse({ description: 'Onboarding link', type: OnboardingLinkSuccessResponseDto })
  createOnboardingLink(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OnboardingLinkResponseDto> {
    return this.service.createOnboardingLink(organizationId);
  }

  @Get('status')
  @Permissions('marketplace.app.manage')
  @ApiOperation({ summary: "Get the organization's Stripe Connect onboarding status" })
  @ApiOkResponse({ description: 'Status', type: DeveloperConnectStatusSuccessResponseDto })
  getStatus(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<DeveloperConnectStatusResponseDto> {
    return this.service.getStatus(organizationId);
  }
}
