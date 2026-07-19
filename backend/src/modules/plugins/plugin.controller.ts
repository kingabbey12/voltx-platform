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
  Query,
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
import { InstallAppResultDto } from '../marketplace/dto/marketplace-install.dto';
import {
  InstallPluginDto,
  InstalledPluginDto,
  ListPluginRegistryQueryDto,
  PluginManifestResponseDto,
  PluginRegistryResponseDto,
} from './dto/plugin.dto';
import { PluginService } from './plugin.service';

class PluginRegistrySuccessResponseDto extends ApiSuccessResponseDto<PluginRegistryResponseDto> {}
class InstalledPluginListSuccessResponseDto extends ApiSuccessResponseDto<InstalledPluginDto[]> {}
class PluginManifestSuccessResponseDto extends ApiSuccessResponseDto<PluginManifestResponseDto> {}
class InstallPluginSuccessResponseDto extends ApiSuccessResponseDto<InstallAppResultDto> {}

@ApiTags('Developer Platform — Plugins')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/plugins')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class PluginController {
  constructor(private readonly service: PluginService) {}

  @Get('registry')
  @Permissions('marketplace.install.read')
  @ApiOperation({ summary: 'List plugin registry apps available for installation' })
  @ApiOkResponse({ description: 'Registry', type: PluginRegistrySuccessResponseDto })
  listRegistry(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query() query: ListPluginRegistryQueryDto,
  ): Promise<PluginRegistryResponseDto> {
    return this.service.listRegistry({
      organizationId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      category: query.category,
      search: query.search,
    });
  }

  @Get()
  @Permissions('marketplace.install.read')
  @ApiOperation({ summary: "List this organization's installed plugins" })
  @ApiOkResponse({ description: 'Installed plugins', type: InstalledPluginListSuccessResponseDto })
  listInstalled(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<InstalledPluginDto[]> {
    return this.service.listInstalled(organizationId);
  }

  @Get(':pluginId/manifest')
  @Permissions('marketplace.install.read')
  @ApiOperation({ summary: 'Get the latest published plugin manifest' })
  @ApiOkResponse({ description: 'Manifest', type: PluginManifestSuccessResponseDto })
  getManifest(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('pluginId', ParseUUIDPipe) pluginId: string,
  ): Promise<PluginManifestResponseDto> {
    return this.service.getManifest(organizationId, pluginId);
  }

  @Post(':pluginId/install')
  @Permissions('marketplace.install.manage')
  @ApiOperation({
    summary:
      'Install a plugin. Free plugins install immediately; paid plugins return a Stripe Checkout URL',
  })
  @ApiCreatedResponse({ description: 'Install result', type: InstallPluginSuccessResponseDto })
  install(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('pluginId', ParseUUIDPipe) pluginId: string,
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: InstallPluginDto,
  ): Promise<InstallAppResultDto> {
    return this.service.install(organizationId, pluginId, user.id, dto);
  }

  @Delete('installs/:installId')
  @Permissions('marketplace.install.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Uninstall a plugin' })
  @ApiOkResponse({ description: 'Plugin uninstalled' })
  async uninstall(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('installId', ParseUUIDPipe) installId: string,
  ): Promise<{ message: string }> {
    await this.service.uninstall(organizationId, installId);
    return { message: 'Plugin uninstalled' };
  }
}
