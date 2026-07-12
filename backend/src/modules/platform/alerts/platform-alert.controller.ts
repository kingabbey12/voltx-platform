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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentAuthPrincipal } from '../../auth/decorators/current-auth-principal.decorator';
import { AuthPrincipal } from '../../auth/interfaces/auth-principal.interface';
import {
  CreatePlatformAlertDto,
  ListPlatformAlertsQueryDto,
  PlatformAlertResponseDto,
} from './dto/platform-alert.dto';
import { PlatformAlertService } from './platform-alert.service';

@ApiTags('Platform Admin — Alerts')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/alerts')
export class PlatformAlertController {
  constructor(private readonly service: PlatformAlertService) {}

  @Post()
  @ApiOperation({ summary: 'Platform admin: raise a platform or organization alert' })
  async create(@Body() dto: CreatePlatformAlertDto): Promise<PlatformAlertResponseDto> {
    const entity = await this.service.create(dto);
    return PlatformAlertResponseDto.fromEntity(entity);
  }

  @Get()
  @ApiOperation({ summary: 'Platform admin: list alerts, optionally filtered' })
  async list(@Query() query: ListPlatformAlertsQueryDto): Promise<PlatformAlertResponseDto[]> {
    const entities = await this.service.list(query);
    return entities.map((entity) => PlatformAlertResponseDto.fromEntity(entity));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Platform admin: get an alert by id' })
  async getOne(@Param('id', ParseUUIDPipe) id: string): Promise<PlatformAlertResponseDto> {
    const entity = await this.service.getOrThrow(id);
    return PlatformAlertResponseDto.fromEntity(entity);
  }

  @Post(':id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform admin: acknowledge an alert' })
  async acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuthPrincipal() principal: AuthPrincipal,
  ): Promise<PlatformAlertResponseDto> {
    const entity = await this.service.acknowledge(id, principal.userId);
    return PlatformAlertResponseDto.fromEntity(entity);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform admin: resolve an alert' })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuthPrincipal() principal: AuthPrincipal,
  ): Promise<PlatformAlertResponseDto> {
    const entity = await this.service.resolve(id, principal.userId);
    return PlatformAlertResponseDto.fromEntity(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform admin: delete an alert' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.service.delete(id);
    return { message: 'Alert deleted' };
  }
}
