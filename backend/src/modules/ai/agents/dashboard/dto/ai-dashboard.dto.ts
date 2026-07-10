import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../../common/dto/api-response.dto';
import { AgentRunResponseDto } from '../../dto/agent.dto';
import { AgentApprovalResponseDto } from '../../approvals/dto/agent-approval.dto';
import { AiSuggestionEntity } from '../../entities/ai-suggestion.entity';

export class ListActivityQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class PerformanceQueryDto {
  @ApiPropertyOptional({ example: 30, description: 'Lookback window in days. Default 30.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lookbackDays?: number;
}

export class AgentPerformanceEntryDto {
  @ApiPropertyOptional({ nullable: true }) agentId!: string | null;
  @ApiPropertyOptional({ nullable: true }) agentName!: string | null;
  @ApiProperty() callCount!: number;
  @ApiProperty() totalTokens!: number;
  @ApiProperty() totalCostUsd!: number;
}

export class AiPerformanceResponseDto {
  @ApiProperty() lookbackDays!: number;
  @ApiProperty() totalCallCount!: number;
  @ApiProperty() totalTokens!: number;
  @ApiProperty() totalCostUsd!: number;
  @ApiProperty({ type: [AgentPerformanceEntryDto] }) byAgent!: AgentPerformanceEntryDto[];
}

export class AiTasksResponseDto {
  @ApiProperty({ type: [AgentApprovalResponseDto] }) pendingApprovals!: AgentApprovalResponseDto[];
  @ApiProperty({ type: [AgentRunResponseDto] }) inProgressRuns!: AgentRunResponseDto[];
}

export class AiSuggestionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() category!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: AiSuggestionEntity): AiSuggestionResponseDto {
    const dto = new AiSuggestionResponseDto();
    dto.id = entity.id;
    dto.category = entity.category;
    dto.title = entity.title;
    dto.description = entity.description;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedActivityResponseDto {
  @ApiProperty({ type: [AgentRunResponseDto] }) items!: AgentRunResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class PaginatedActivitySuccessResponseDto extends ApiSuccessResponseDto<PaginatedActivityResponseDto> {}
export class AiPerformanceSuccessResponseDto extends ApiSuccessResponseDto<AiPerformanceResponseDto> {}
export class AiTasksSuccessResponseDto extends ApiSuccessResponseDto<AiTasksResponseDto> {}
export class AiSuggestionsSuccessResponseDto extends ApiSuccessResponseDto<
  AiSuggestionResponseDto[]
> {}
