import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsInt,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../common/dto/api-response.dto';
import { CommsConversationEntity } from '../entities/conversation.entity';
import { CommsMessageEntity } from '../entities/message.entity';
import { CommsNoteEntity } from '../entities/note.entity';

const STATUS_KEYS = ['OPEN', 'PINNED', 'ARCHIVED'] as const;
const PRIORITY_KEYS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export class ListConversationsQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: STATUS_KEYS }) @IsOptional() @IsIn(STATUS_KEYS) status?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Boolean) @IsBoolean() unread?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeId?: string;
  @ApiPropertyOptional({ enum: PRIORITY_KEYS })
  @IsOptional()
  @IsIn(PRIORITY_KEYS)
  priority?: string;
}

export class UpdateConversationDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() contactId?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() assigneeId?: string | null;
  @ApiPropertyOptional({ enum: STATUS_KEYS }) @IsOptional() @IsIn(STATUS_KEYS) status?: string;
  @ApiPropertyOptional({ enum: PRIORITY_KEYS })
  @IsOptional()
  @IsIn(PRIORITY_KEYS)
  priority?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() unread?: boolean;
}

export class SendMessageDto {
  @ApiProperty()
  @IsString()
  body!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachmentIds?: string[];
}

export class CreateNoteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body!: string;
}

export class ConversationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() connectionId!: string;
  @ApiPropertyOptional({ nullable: true }) contactId!: string | null;
  @ApiPropertyOptional({ nullable: true }) assigneeId!: string | null;
  @ApiProperty() channel!: string;
  @ApiPropertyOptional({ nullable: true }) subject!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() priority!: string;
  @ApiProperty() unread!: boolean;
  @ApiPropertyOptional({ nullable: true }) lastMessageAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: CommsConversationEntity): ConversationResponseDto {
    const dto = new ConversationResponseDto();
    dto.id = entity.id;
    dto.connectionId = entity.connectionId;
    dto.contactId = entity.contactId;
    dto.assigneeId = entity.assigneeId;
    dto.channel = entity.channel;
    dto.subject = entity.subject;
    dto.status = entity.status;
    dto.priority = entity.priority;
    dto.unread = entity.unread;
    dto.lastMessageAt = entity.lastMessageAt ? entity.lastMessageAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class MessageResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() conversationId!: string;
  @ApiProperty() direction!: string;
  @ApiProperty() channel!: string;
  @ApiProperty() status!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: CommsMessageEntity): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.direction = entity.direction;
    dto.channel = entity.channel;
    dto.status = entity.status;
    dto.body = entity.body;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class NoteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() conversationId!: string;
  @ApiProperty() authorId!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: CommsNoteEntity): NoteResponseDto {
    const dto = new NoteResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.authorId = entity.authorId;
    dto.body = entity.body;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedConversationsResponseDto {
  @ApiProperty({ type: [ConversationResponseDto] }) items!: ConversationResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class PaginatedMessagesResponseDto {
  @ApiProperty({ type: [MessageResponseDto] }) items!: MessageResponseDto[];
  @ApiProperty() total!: number;
}

export class ConversationSuccessResponseDto extends ApiSuccessResponseDto<ConversationResponseDto> {}
export class PaginatedConversationsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedConversationsResponseDto> {}
export class MessageSuccessResponseDto extends ApiSuccessResponseDto<MessageResponseDto> {}
export class PaginatedMessagesSuccessResponseDto extends ApiSuccessResponseDto<PaginatedMessagesResponseDto> {}
export class NoteSuccessResponseDto extends ApiSuccessResponseDto<NoteResponseDto> {}
export class NotesListSuccessResponseDto extends ApiSuccessResponseDto<NoteResponseDto[]> {}
