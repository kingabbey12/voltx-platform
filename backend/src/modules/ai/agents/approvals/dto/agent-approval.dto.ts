import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../../../../common/dto/api-response.dto';
import { AgentActionApprovalEntity } from '../../../../ai/approvals/entities/agent-action-approval.entity';

export class ListPendingApprovalsQueryDto {
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

export class DecideAgentApprovalDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Optional reason, shown back to the agent on rejection.' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class AgentApprovalResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() agentRunId!: string;
  @ApiProperty() toolName!: string;
  @ApiProperty({ type: Object }) input!: Record<string, unknown>;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Owner-facing sentence written at creation — clients render this, never their own.',
  })
  summary!: string | null;
  @ApiProperty() status!: string;
  @ApiPropertyOptional({ nullable: true }) approverUserId!: string | null;
  @ApiPropertyOptional({ nullable: true }) comment!: string | null;
  @ApiPropertyOptional({ nullable: true }) decidedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: AgentActionApprovalEntity): AgentApprovalResponseDto {
    const dto = new AgentApprovalResponseDto();
    dto.id = entity.id;
    dto.agentRunId = entity.agentRunId;
    dto.toolName = entity.toolName;
    dto.input = entity.input;
    dto.summary = entity.summary;
    dto.status = entity.status;
    dto.approverUserId = entity.approverUserId;
    dto.comment = entity.comment;
    dto.decidedAt = entity.decidedAt ? entity.decidedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class PaginatedAgentApprovalsResponseDto {
  @ApiProperty({ type: [AgentApprovalResponseDto] }) items!: AgentApprovalResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() totalPages!: number;
}

export class AgentApprovalSuccessResponseDto extends ApiSuccessResponseDto<AgentApprovalResponseDto> {}
export class PaginatedAgentApprovalsSuccessResponseDto extends ApiSuccessResponseDto<PaginatedAgentApprovalsResponseDto> {}
