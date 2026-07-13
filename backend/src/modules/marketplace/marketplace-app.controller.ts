import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateMarketplaceAppDto,
  CreateMarketplaceAppVersionDto,
  MarketplaceAppResponseDto,
  MarketplaceAppVersionResponseDto,
  UpdateMarketplaceAppDto,
} from './dto/marketplace-app.dto';
import { MarketplaceAppService } from './marketplace-app.service';

class MarketplaceAppSuccessResponseDto extends ApiSuccessResponseDto<MarketplaceAppResponseDto> {}
class MarketplaceAppListSuccessResponseDto extends ApiSuccessResponseDto<
  MarketplaceAppResponseDto[]
> {}
class MarketplaceAppVersionSuccessResponseDto extends ApiSuccessResponseDto<MarketplaceAppVersionResponseDto> {}
class MarketplaceAppVersionListSuccessResponseDto extends ApiSuccessResponseDto<
  MarketplaceAppVersionResponseDto[]
> {}

/** Developer-facing app management — a developer organization creates and
 * maintains its own listings here; publication requires platform-admin
 * approval (see MarketplaceVersionReviewController). */
@ApiTags('Developer Platform — Marketplace Apps')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/marketplace/apps')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class MarketplaceAppController {
  constructor(private readonly service: MarketplaceAppService) {}

  @Post()
  @Permissions('marketplace.app.manage')
  @ApiOperation({ summary: 'Register a new marketplace app (starts in DRAFT)' })
  @ApiCreatedResponse({ description: 'App created', type: MarketplaceAppSuccessResponseDto })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateMarketplaceAppDto,
  ): Promise<MarketplaceAppResponseDto> {
    return this.service.create(organizationId, dto);
  }

  @Get()
  @Permissions('marketplace.app.read')
  @ApiOperation({ summary: "List the organization's own marketplace apps" })
  @ApiOkResponse({ description: 'Apps', type: MarketplaceAppListSuccessResponseDto })
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<MarketplaceAppResponseDto[]> {
    return this.service.list(organizationId);
  }

  @Get(':id')
  @Permissions('marketplace.app.read')
  @ApiOperation({ summary: "Get one of the organization's marketplace apps" })
  @ApiOkResponse({ description: 'App', type: MarketplaceAppSuccessResponseDto })
  getOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MarketplaceAppResponseDto> {
    return this.service.getOrThrow(id, organizationId);
  }

  @Patch(':id')
  @Permissions('marketplace.app.manage')
  @ApiOperation({ summary: "Update a marketplace app's listing metadata" })
  @ApiOkResponse({ description: 'App updated', type: MarketplaceAppSuccessResponseDto })
  update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMarketplaceAppDto,
  ): Promise<MarketplaceAppResponseDto> {
    return this.service.update(id, organizationId, dto);
  }

  @Post(':id/versions')
  @Permissions('marketplace.app.manage')
  @ApiOperation({ summary: 'Submit a new version for platform-admin review' })
  @ApiCreatedResponse({
    description: 'Version submitted',
    type: MarketplaceAppVersionSuccessResponseDto,
  })
  createVersion(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMarketplaceAppVersionDto,
  ): Promise<MarketplaceAppVersionResponseDto> {
    return this.service.createVersion(id, organizationId, dto);
  }

  @Get(':id/versions')
  @Permissions('marketplace.app.read')
  @ApiOperation({ summary: "List an app's submitted versions" })
  @ApiOkResponse({ description: 'Versions', type: MarketplaceAppVersionListSuccessResponseDto })
  listVersions(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MarketplaceAppVersionResponseDto[]> {
    return this.service.listVersions(id, organizationId);
  }
}
