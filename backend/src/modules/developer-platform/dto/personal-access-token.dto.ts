import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PersonalAccessTokenEntity } from '../entities/personal-access-token.entity';

export class CreatePersonalAccessTokenDto {
  @ApiProperty({ example: 'Local dev script' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    example: ['sales.opportunity.read'],
    description:
      'Must be real, known permission keys. Effective access at request time is further ' +
      "narrowed to whatever the token's organization membership currently holds (see " +
      'PersonalAccessTokenGuard) — granting a key here you do not yet hold in some org is ' +
      'harmless, since it can never grant more than that org membership allows.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopedPermissions!: string[];

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class PersonalAccessTokenResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'Local dev script' })
  name!: string;

  @ApiProperty({ example: 'vpat_ab12cd34...' })
  tokenPrefix!: string;

  @ApiProperty({ example: ['sales.opportunity.read'] })
  scopedPermissions!: string[];

  @ApiPropertyOptional({ nullable: true })
  expiresAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  lastUsedAt!: string | null;

  @ApiPropertyOptional({ nullable: true })
  revokedAt!: string | null;

  @ApiProperty()
  createdAt!: string;

  static fromEntity(entity: PersonalAccessTokenEntity): PersonalAccessTokenResponseDto {
    const dto = new PersonalAccessTokenResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.tokenPrefix = entity.tokenPrefix;
    dto.scopedPermissions = entity.scopedPermissions;
    dto.expiresAt = entity.expiresAt?.toISOString() ?? null;
    dto.lastUsedAt = entity.lastUsedAt?.toISOString() ?? null;
    dto.revokedAt = entity.revokedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class CreatePersonalAccessTokenResponseDto extends PersonalAccessTokenResponseDto {
  @ApiProperty({
    example: 'vpat_ab12cd34_9fY3z...',
    description: 'The full token — shown exactly once, never retrievable again',
  })
  token!: string;
}
