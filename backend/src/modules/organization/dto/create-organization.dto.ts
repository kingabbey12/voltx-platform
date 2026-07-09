import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanySize, OrganizationStatus } from '@prisma/client';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsISO31661Alpha2,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({
    example: 'Acme Corporation',
    minLength: 2,
    maxLength: 255,
    description: 'Organization name. A unique slug is generated automatically from this value.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logos/acme.png' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'hello@acme.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  website?: string;

  @ApiPropertyOptional({ example: 'Software / SaaS' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @ApiPropertyOptional({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;

  @ApiPropertyOptional({ example: 'CA', description: 'State/province code or name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: 'San Francisco' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ enum: CompanySize, example: CompanySize.EMPLOYEES_2_10 })
  @IsOptional()
  @IsEnum(CompanySize)
  companySize?: CompanySize;

  @ApiPropertyOptional({ example: ['SALES', 'CRM'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  primaryGoals?: string[];

  @ApiPropertyOptional({ example: 'USD', description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  @ApiPropertyOptional({ example: 'en', description: 'ISO 639-1 language code' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({
    example: '+14155551234',
    description: 'Full phone number in international format',
  })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ example: 'America/New_York', default: 'UTC' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;

  @ApiPropertyOptional({ enum: OrganizationStatus, default: OrganizationStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OrganizationStatus)
  status?: OrganizationStatus;

  @ApiPropertyOptional({
    example: { theme: 'dark', notifications: true },
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
