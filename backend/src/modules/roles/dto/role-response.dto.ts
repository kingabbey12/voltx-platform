import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleEntity } from '../entities/role.entity';

export class RoleResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'admin' })
  key!: string;

  @ApiProperty({ example: 'Admin' })
  name!: string;

  @ApiPropertyOptional({ example: 'Administrative access', nullable: true })
  description!: string | null;

  @ApiProperty({ example: true })
  isSystem!: boolean;

  @ApiProperty({ example: ['organization.read', 'user.read'], type: [String] })
  permissions!: string[];

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: RoleEntity): RoleResponseDto {
    const dto = new RoleResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.name = entity.name;
    dto.description = entity.description;
    dto.isSystem = entity.isSystem;
    dto.permissions = entity.permissionKeys;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class RoleListResponseDto {
  @ApiProperty({ type: [RoleResponseDto] })
  items!: RoleResponseDto[];
}
