import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvitationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { InvitationEntity, InvitationPreviewEntity } from '../invitation.entity';

export class CreateInvitationDto {
  @ApiProperty({ example: 'jane.doe@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Role to grant on acceptance',
  })
  @IsUUID()
  roleId!: string;
}

export class ListInvitationsQueryDto {
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

  @ApiPropertyOptional({ enum: InvitationStatus })
  @IsOptional()
  @IsEnum(InvitationStatus)
  status?: InvitationStatus;
}

export class AcceptInvitationDto {
  @ApiPropertyOptional({
    description: 'Required only when no account exists yet for the invited email',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    description: 'Required only when creating a new account',
    example: 'Jane',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Required only when creating a new account', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;
}

export class InvitationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() email!: string;
  @ApiProperty() roleId!: string;
  @ApiProperty() roleName!: string;
  @ApiProperty({ enum: InvitationStatus }) status!: InvitationStatus;
  @ApiProperty() invitedByUserId!: string;
  @ApiProperty() invitedByName!: string;
  @ApiProperty({ nullable: true }) acceptedByUserId!: string | null;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ nullable: true }) acceptedAt!: string | null;
  @ApiProperty({ nullable: true }) revokedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: InvitationEntity): InvitationResponseDto {
    const dto = new InvitationResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.email = entity.email;
    dto.roleId = entity.roleId;
    dto.roleName = entity.roleName;
    dto.status = entity.status;
    dto.invitedByUserId = entity.invitedByUserId;
    dto.invitedByName = entity.invitedByName;
    dto.acceptedByUserId = entity.acceptedByUserId;
    dto.expiresAt = entity.expiresAt.toISOString();
    dto.acceptedAt = entity.acceptedAt?.toISOString() ?? null;
    dto.revokedAt = entity.revokedAt?.toISOString() ?? null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

/** Returned alongside the created invitation — there is no email-sending
 * infrastructure in this backend (the same is true of password-reset/email
 * verification), so the inviter is handed the shareable link directly. */
export class CreateInvitationResponseDto extends InvitationResponseDto {
  @ApiProperty({
    description: 'Shareable invitation link — include this in an email/message to the invitee',
  })
  invitationLink!: string;

  static fromEntityAndLink(
    entity: InvitationEntity,
    invitationLink: string,
  ): CreateInvitationResponseDto {
    const base = InvitationResponseDto.fromEntity(entity);
    const dto = new CreateInvitationResponseDto();
    Object.assign(dto, base);
    dto.invitationLink = invitationLink;
    return dto;
  }
}

export class PaginatedInvitationsDto {
  @ApiProperty({ type: [InvitationResponseDto] })
  items!: InvitationResponseDto[];

  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class InvitationPreviewResponseDto {
  @ApiProperty() organizationName!: string;
  @ApiProperty() invitedByName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() roleName!: string;
  @ApiProperty({ enum: InvitationStatus }) status!: InvitationStatus;
  @ApiProperty() expiresAt!: string;
  @ApiProperty() hasExistingAccount!: boolean;

  static fromEntity(entity: InvitationPreviewEntity): InvitationPreviewResponseDto {
    const dto = new InvitationPreviewResponseDto();
    dto.organizationName = entity.organizationName;
    dto.invitedByName = entity.invitedByName;
    dto.email = entity.email;
    dto.roleName = entity.roleName;
    dto.status = entity.status;
    dto.expiresAt = entity.expiresAt.toISOString();
    dto.hasExistingAccount = entity.hasExistingAccount;
    return dto;
  }
}
