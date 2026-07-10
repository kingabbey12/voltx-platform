import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { AttachmentEntity, AttachmentReferenceType } from '../entities/attachment.entity';

const REFERENCE_TYPES: AttachmentReferenceType[] = [
  'AI_CONVERSATION',
  'AI_MESSAGE',
  'CRM_CONTACT',
  'CRM_COMPANY',
  'CRM_LEAD',
  'CRM_OPPORTUNITY',
  'CRM_ACTIVITY',
  'COMMS_MESSAGE',
];

export class AttachmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) width!: number | null;
  @ApiPropertyOptional({ nullable: true }) height!: number | null;
  @ApiProperty() hasThumbnail!: boolean;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: AttachmentEntity): AttachmentResponseDto {
    const dto = new AttachmentResponseDto();
    dto.id = entity.id;
    dto.fileName = entity.fileName;
    dto.mimeType = entity.mimeType;
    dto.sizeBytes = entity.sizeBytes;
    dto.status = entity.status;
    dto.width = entity.width;
    dto.height = entity.height;
    dto.hasThumbnail = entity.thumbnailKey !== null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedAttachmentsDto {
  @ApiProperty({ type: [AttachmentResponseDto] }) items!: AttachmentResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class ListAttachmentsQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;

  @ApiPropertyOptional({ enum: REFERENCE_TYPES })
  @IsOptional()
  @IsIn(REFERENCE_TYPES)
  referenceType?: AttachmentReferenceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;
}

export class CreateAttachmentReferenceDto {
  @ApiProperty({ enum: REFERENCE_TYPES })
  @IsIn(REFERENCE_TYPES)
  referenceType!: AttachmentReferenceType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  referenceId!: string;
}

export class InitiateMultipartUploadDto {
  @ApiProperty() @IsString() @MinLength(1) fileName!: string;
  @ApiProperty() @IsString() @MinLength(1) mimeType!: string;
  @ApiProperty() @IsInt() @Min(1) sizeBytes!: number;
}

export class InitiateMultipartUploadResponseDto {
  @ApiProperty() attachmentId!: string;
  @ApiProperty() uploadId!: string;
  @ApiProperty() partSizeBytes!: number;
}

class MultipartUploadPartDto {
  @ApiProperty() @IsInt() @Min(1) partNumber!: number;
  @ApiProperty() @IsString() @MinLength(1) etag!: string;
}

export class CompleteMultipartUploadDto {
  @ApiProperty({ type: [MultipartUploadPartDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MultipartUploadPartDto)
  parts!: MultipartUploadPartDto[];
}

export class SignedDownloadUrlResponseDto {
  @ApiProperty() url!: string;
  @ApiProperty() expiresAt!: string;
}
