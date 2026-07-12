import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import {
  CreateFeatureFlagDto,
  FeatureFlagResponseDto,
  ResolvedFeatureFlagResponseDto,
  SetFeatureFlagOverrideDto,
  UpdateFeatureFlagDto,
} from './dto/feature-flag.dto';
import { FeatureFlagService } from './feature-flag.service';

@ApiTags('Platform Admin — Feature Flags')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/feature-flags')
export class FeatureFlagController {
  constructor(private readonly service: FeatureFlagService) {}

  @Post()
  @ApiOperation({ summary: 'Platform admin: create a feature flag' })
  async create(@Body() dto: CreateFeatureFlagDto): Promise<FeatureFlagResponseDto> {
    const entity = await this.service.create(dto);
    return FeatureFlagResponseDto.fromEntity(entity);
  }

  @Get()
  @ApiOperation({ summary: 'Platform admin: list all feature flags' })
  async list(): Promise<FeatureFlagResponseDto[]> {
    const entities = await this.service.list();
    return entities.map((entity) => FeatureFlagResponseDto.fromEntity(entity));
  }

  @Get(':key')
  @ApiOperation({ summary: 'Platform admin: get a feature flag by key' })
  async getOne(@Param('key') key: string): Promise<FeatureFlagResponseDto> {
    const entity = await this.service.getOrThrow(key);
    return FeatureFlagResponseDto.fromEntity(entity);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Platform admin: update a feature flag' })
  async update(
    @Param('key') key: string,
    @Body() dto: UpdateFeatureFlagDto,
  ): Promise<FeatureFlagResponseDto> {
    const entity = await this.service.update(key, dto);
    return FeatureFlagResponseDto.fromEntity(entity);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform admin: delete a feature flag' })
  async remove(@Param('key') key: string): Promise<{ message: string }> {
    await this.service.delete(key);
    return { message: 'Feature flag deleted' };
  }

  @Put(':key/overrides/:organizationId')
  @ApiOperation({ summary: "Platform admin: set an organization's override value for a flag" })
  async setOverride(
    @Param('key') key: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: SetFeatureFlagOverrideDto,
  ): Promise<FeatureFlagResponseDto> {
    const entity = await this.service.setOverride(key, organizationId, dto.value);
    return FeatureFlagResponseDto.fromEntity(entity);
  }

  @Delete(':key/overrides/:organizationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Platform admin: remove an organization's override for a flag" })
  async removeOverride(
    @Param('key') key: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<FeatureFlagResponseDto> {
    const entity = await this.service.removeOverride(key, organizationId);
    return FeatureFlagResponseDto.fromEntity(entity);
  }

  @Get(':key/resolve/:organizationId')
  @ApiOperation({ summary: "Platform admin: resolve a flag's effective value for an organization" })
  async resolve(
    @Param('key') key: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<ResolvedFeatureFlagResponseDto> {
    const result = await this.service.resolve(key, organizationId);
    return ResolvedFeatureFlagResponseDto.fromResult(result);
  }
}
