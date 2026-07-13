import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  InstallAppResultDto,
  InstallMarketplaceAppDto,
  MarketplaceInstallResponseDto,
} from './dto/marketplace-install.dto';
import { MarketplaceInstallService } from './marketplace-install.service';

class MarketplaceInstallSuccessResponseDto extends ApiSuccessResponseDto<MarketplaceInstallResponseDto> {}
class MarketplaceInstallListSuccessResponseDto extends ApiSuccessResponseDto<
  MarketplaceInstallResponseDto[]
> {}
class InstallAppResultSuccessResponseDto extends ApiSuccessResponseDto<InstallAppResultDto> {}

@ApiTags('Developer Platform — Marketplace Installs')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/marketplace')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class MarketplaceInstallController {
  constructor(private readonly service: MarketplaceInstallService) {}

  @Get('installs')
  @Permissions('marketplace.install.read')
  @ApiOperation({ summary: "List the organization's active app installs" })
  @ApiOkResponse({ description: 'Installs', type: MarketplaceInstallListSuccessResponseDto })
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<MarketplaceInstallResponseDto[]> {
    return this.service.listInstalled(organizationId);
  }

  @Get('installs/:id')
  @Permissions('marketplace.install.read')
  @ApiOperation({ summary: 'Get one install by id' })
  @ApiOkResponse({ description: 'Install', type: MarketplaceInstallSuccessResponseDto })
  getOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MarketplaceInstallResponseDto> {
    return this.service.getOrThrow(id, organizationId);
  }

  @Post('apps/:appId/install')
  @Permissions('marketplace.install.manage')
  @ApiOperation({
    summary:
      'Install a marketplace app — free apps install immediately, paid apps return a Stripe Checkout URL',
  })
  @ApiCreatedResponse({ description: 'Install result', type: InstallAppResultSuccessResponseDto })
  install(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('appId', ParseUUIDPipe) appId: string,
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: InstallMarketplaceAppDto,
  ): Promise<InstallAppResultDto> {
    return this.service.install(organizationId, appId, user.id, dto);
  }

  @Delete('installs/:id')
  @Permissions('marketplace.install.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uninstall a marketplace app' })
  @ApiOkResponse({ description: 'App uninstalled' })
  async uninstall(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.uninstall(id, organizationId);
    return { message: 'Marketplace app uninstalled' };
  }
}
