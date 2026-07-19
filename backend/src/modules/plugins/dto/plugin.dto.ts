import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InstallMarketplaceAppDto } from '../../marketplace/dto/marketplace-install.dto';

export class ListPluginRegistryQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'ANALYTICS' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'reporting' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class PluginRegistryItemDto {
  @ApiProperty() pluginId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() category!: string;
  @ApiPropertyOptional({ nullable: true }) iconUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) latestVersion!: string | null;
  @ApiPropertyOptional({ nullable: true }) priceCents!: number | null;
  @ApiProperty() isInstalled!: boolean;
}

export class PluginRegistryResponseDto {
  @ApiProperty({ type: [PluginRegistryItemDto] }) items!: PluginRegistryItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class InstalledPluginDto {
  @ApiProperty() installId!: string;
  @ApiProperty() pluginId!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() installedVersionId!: string;
  @ApiPropertyOptional({ nullable: true }) installedVersion!: string | null;
  @ApiProperty() createdAt!: string;
}

export class PluginManifestResponseDto {
  @ApiProperty() pluginId!: string;
  @ApiProperty() versionId!: string;
  @ApiProperty() version!: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) manifest!: Record<string, unknown>;
}

export class InstallPluginDto extends InstallMarketplaceAppDto {}
