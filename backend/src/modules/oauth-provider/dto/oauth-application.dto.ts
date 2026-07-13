import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OAuthApplicationStatus } from '@prisma/client';
import { ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { OAuthApplicationEntity } from '../entities/oauth-application.entity';

export class CreateOAuthApplicationDto {
  @ApiProperty({ example: 'Acme Reporting' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'Syncs Voltx sales activity into Acme dashboards' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://acme.example/logo.png' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  logoUrl?: string;

  @ApiProperty({
    example: ['https://acme.example/oauth/callback'],
    description: 'At least one absolute http(s) redirect URI. Non-loopback URIs must be https.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  redirectUris!: string[];

  @ApiProperty({
    example: ['sales.opportunity.read', 'sales.contact.read'],
    description:
      "Maximum permission keys this app can ever request — must be a subset of the registering user's own permissions",
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes!: string[];
}

export class UpdateOAuthApplicationDto {
  @ApiPropertyOptional({ example: 'Acme Reporting' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Syncs Voltx sales activity into Acme dashboards' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://acme.example/logo.png' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  logoUrl?: string;

  @ApiPropertyOptional({
    example: ['https://acme.example/oauth/callback'],
    description: 'Replaces the full set of registered redirect URIs',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  redirectUris?: string[];

  @ApiPropertyOptional({
    example: ['sales.opportunity.read'],
    description: 'Replaces the full set of scopes this app can request',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes?: string[];
}

export class OAuthApplicationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true }) logoUrl!: string | null;
  @ApiProperty({ example: 'client_9fY3zAb12cd34' }) clientId!: string;
  @ApiProperty({ example: 'vcs_ab12cd34...' }) clientSecretPrefix!: string;
  @ApiProperty({ example: ['sales.opportunity.read'] }) scopes!: string[];
  @ApiProperty({ example: ['https://acme.example/oauth/callback'] }) redirectUris!: string[];
  @ApiProperty({ enum: OAuthApplicationStatus }) status!: OAuthApplicationStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;

  static fromEntity(
    entity: OAuthApplicationEntity,
    redirectUris: string[],
  ): OAuthApplicationResponseDto {
    const dto = new OAuthApplicationResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.logoUrl = entity.logoUrl;
    dto.clientId = entity.clientId;
    dto.clientSecretPrefix = entity.clientSecretPrefix;
    dto.scopes = entity.scopes;
    dto.redirectUris = redirectUris;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class CreateOAuthApplicationResponseDto extends OAuthApplicationResponseDto {
  @ApiProperty({
    example: 'vcs_ab12cd34_9fY3z...',
    description: 'The full client secret — shown exactly once, never retrievable again',
  })
  clientSecret!: string;
}

export class RotateOAuthApplicationSecretResponseDto {
  @ApiProperty({ example: 'vcs_ab12cd34...' }) clientSecretPrefix!: string;

  @ApiProperty({
    example: 'vcs_ef56gh78_kL9mN...',
    description: 'The new full client secret — shown exactly once, never retrievable again',
  })
  clientSecret!: string;
}
