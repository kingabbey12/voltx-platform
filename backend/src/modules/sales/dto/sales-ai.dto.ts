import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { MessageResponseDto } from '../../ai/conversations/dto/conversation.dto';

export class SalesAiActionDto {
  @ApiPropertyOptional({
    example: 'Focus on enterprise buying signals and implementation urgency.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  prompt?: string;

  @ApiPropertyOptional({ type: [String], example: ['Region: EMEA', 'Segment: Enterprise'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  workspaceContext?: string[];
}

export class SalesAiActionResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  conversationId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  agentRunId!: string;

  @ApiProperty({ example: 'Generated recommendation text.' })
  outputText!: string;

  @ApiProperty({ type: MessageResponseDto, nullable: true })
  assistantMessage!: MessageResponseDto | null;

  @ApiProperty({ type: [MessageResponseDto] })
  toolMessages!: MessageResponseDto[];
}

export class SalesAiActionSuccessResponseDto extends ApiSuccessResponseDto<SalesAiActionResponseDto> {}
