import { IsString, MaxLength, MinLength } from 'class-validator';
import { SupportNoteEntity } from '../entities/support-note.entity';

export class CreateSupportNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  note!: string;
}

export class SupportNoteResponseDto {
  id!: string;
  organizationId!: string;
  authorId!: string;
  note!: string;
  createdAt!: string;
  updatedAt!: string;

  static fromEntity(entity: SupportNoteEntity): SupportNoteResponseDto {
    const dto = new SupportNoteResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.authorId = entity.authorId;
    dto.note = entity.note;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
