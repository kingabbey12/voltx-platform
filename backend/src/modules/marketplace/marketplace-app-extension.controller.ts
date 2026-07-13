import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { ExtensionAiToolResponseDto } from '../extensions/dto/extension.dto';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { MarketplaceAppExtensionService } from './marketplace-app-extension.service';

class ExtensionAiToolListSuccessResponseDto extends ApiSuccessResponseDto<
  ExtensionAiToolResponseDto[]
> {}

@ApiTags('Developer Platform — Marketplace App Extensions')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/marketplace/apps/:appId/extensions/ai-tools')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class MarketplaceAppExtensionController {
  constructor(private readonly service: MarketplaceAppExtensionService) {}

  @Get()
  @Permissions('marketplace.app.manage')
  @ApiOperation({
    summary:
      "List the app's materialized Custom AI Tools (from its latest published version), including the current signing secret to configure on your own endpoint",
  })
  @ApiOkResponse({ description: 'Custom AI Tools', type: ExtensionAiToolListSuccessResponseDto })
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('appId', ParseUUIDPipe) appId: string,
  ): Promise<ExtensionAiToolResponseDto[]> {
    return this.service.listAiTools(appId, organizationId);
  }
}
