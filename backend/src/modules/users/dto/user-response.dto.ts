import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserEntity } from '../entities/user.entity';

export class ListUsersQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ example: 'jane', description: 'Filter by name or email' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: 'jane.doe@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatars/jane.png', nullable: true })
  avatarUrl!: string | null;

  @ApiPropertyOptional({ example: '+14155552671', nullable: true })
  phoneNumber!: string | null;

  @ApiPropertyOptional({ example: 'Engineering Manager', nullable: true })
  jobTitle!: string | null;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status!: UserStatus;

  @ApiProperty({
    example: false,
    description: 'Cross-organization Super Admin Billing Console access',
  })
  isPlatformAdmin!: boolean;

  @ApiPropertyOptional({ example: '2026-07-03T00:00:00.000Z', nullable: true })
  lastLoginAt!: string | null;

  @ApiPropertyOptional({ example: '2026-07-03T00:00:00.000Z', nullable: true })
  emailVerifiedAt!: string | null;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-03T00:00:00.000Z' })
  updatedAt!: string;

  static fromEntity(entity: UserEntity): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = entity.id;
    dto.email = entity.email;
    dto.firstName = entity.firstName;
    dto.lastName = entity.lastName;
    dto.avatarUrl = entity.avatarUrl;
    dto.phoneNumber = entity.phoneNumber;
    dto.jobTitle = entity.jobTitle;
    dto.status = entity.status;
    dto.isPlatformAdmin = entity.isPlatformAdmin;
    dto.lastLoginAt = entity.lastLoginAt?.toISOString() ?? null;
    dto.emailVerifiedAt = entity.emailVerifiedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}

export class PaginatedUsersDto {
  @ApiProperty({ type: [UserResponseDto] })
  items!: UserResponseDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}
