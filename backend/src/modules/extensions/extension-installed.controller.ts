import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { InstalledExtensionsResponseDto } from './dto/extension.dto';
import { ExtensionInstalledService } from './extension-installed.service';

class InstalledExtensionsSuccessResponseDto extends ApiSuccessResponseDto<InstalledExtensionsResponseDto> {}

/** What the installing organization's own web app renders — Custom
 * Pages/Widgets/Nav from every app it has actively installed. */
@ApiTags('Developer Platform — Installed Extensions')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/extensions/installed')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class ExtensionInstalledController {
  constructor(private readonly service: ExtensionInstalledService) {}

  @Get()
  @Permissions('marketplace.install.read')
  @ApiOperation({ summary: "List this organization's installed Custom Pages/Widgets/Nav entries" })
  @ApiOkResponse({
    description: 'Installed extensions',
    type: InstalledExtensionsSuccessResponseDto,
  })
  get(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<InstalledExtensionsResponseDto> {
    return this.service.getInstalledForOrganization(organizationId);
  }
}
