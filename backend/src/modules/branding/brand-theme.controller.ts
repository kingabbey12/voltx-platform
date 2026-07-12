import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { BrandAsset, BrandThemeService } from './brand-theme.service';
import { BrandThemeResponseDto, UpdateBrandThemeDto } from './dto/branding.dto';

@ApiTags('Enterprise White-label')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/branding/theme')
export class BrandThemeController {
  constructor(private readonly brandThemeService: BrandThemeService) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.theme.read')
  @ApiOperation({ summary: "Get this organization's brand theme" })
  async get(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<BrandThemeResponseDto> {
    const entity = await this.brandThemeService.getOrDefault(organizationId);
    const urls = await this.brandThemeService.resolveUrls(entity);
    return BrandThemeResponseDto.fromEntity(entity, urls);
  }

  @Patch()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.theme.manage')
  @ApiOperation({ summary: "Update this organization's brand theme (colors, login copy)" })
  async update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: UpdateBrandThemeDto,
  ): Promise<BrandThemeResponseDto> {
    const entity = await this.brandThemeService.update(organizationId, dto);
    const urls = await this.brandThemeService.resolveUrls(entity);
    return BrandThemeResponseDto.fromEntity(entity, urls);
  }

  @Post('logo')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.theme.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload the organization logo' })
  async uploadLogo(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<BrandThemeResponseDto> {
    return this.uploadAsset(organizationId, 'logo', file);
  }

  @Post('favicon')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.theme.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload the organization favicon' })
  async uploadFavicon(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<BrandThemeResponseDto> {
    return this.uploadAsset(organizationId, 'favicon', file);
  }

  @Post('login-background')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('branding.theme.manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Upload the custom login screen background image' })
  async uploadLoginBackground(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<BrandThemeResponseDto> {
    return this.uploadAsset(organizationId, 'loginBackground', file);
  }

  private async uploadAsset(
    organizationId: string,
    asset: BrandAsset,
    file?: Express.Multer.File,
  ): Promise<BrandThemeResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    const entity = await this.brandThemeService.uploadAsset(organizationId, asset, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
    const urls = await this.brandThemeService.resolveUrls(entity);
    return BrandThemeResponseDto.fromEntity(entity, urls);
  }
}
