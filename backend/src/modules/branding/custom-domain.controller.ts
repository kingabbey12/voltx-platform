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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { CustomDomainService } from './custom-domain.service';
import { CreateCustomDomainDto, CustomDomainResponseDto } from './dto/branding.dto';

@ApiTags('Enterprise White-label')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/branding/domains')
export class CustomDomainController {
  constructor(private readonly customDomainService: CustomDomainService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.domain.manage')
  @ApiOperation({ summary: 'Register a custom domain for this organization' })
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateCustomDomainDto,
  ): Promise<CustomDomainResponseDto> {
    const entity = await this.customDomainService.create(organizationId, dto);
    return CustomDomainResponseDto.fromEntity(entity);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.domain.read')
  @ApiOperation({ summary: 'List custom domains for this organization' })
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<CustomDomainResponseDto[]> {
    const entities = await this.customDomainService.list(organizationId);
    return entities.map((entity) => CustomDomainResponseDto.fromEntity(entity));
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.domain.manage')
  @ApiOperation({ summary: 'Check DNS for the verification TXT record and update status' })
  async verify(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CustomDomainResponseDto> {
    const entity = await this.customDomainService.verify(organizationId, id);
    return CustomDomainResponseDto.fromEntity(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.domain.manage')
  @ApiOperation({ summary: 'Remove a custom domain' })
  async remove(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.customDomainService.delete(organizationId, id);
    return { message: 'Custom domain removed' };
  }
}
