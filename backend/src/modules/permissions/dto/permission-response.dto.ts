import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionEntity } from '../entities/permission.entity';

export class PermissionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'organization.read' })
  key!: string;

  @ApiProperty({ example: 'organization' })
  resource!: string;

  @ApiProperty({ example: 'read' })
  action!: string;

  @ApiPropertyOptional({ example: 'Read organizations', nullable: true })
  description!: string | null;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: PermissionEntity): PermissionResponseDto {
    const dto = new PermissionResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.resource = entity.resource;
    dto.action = entity.action;
    dto.description = entity.description;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
