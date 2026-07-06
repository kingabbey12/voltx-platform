import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import {
  WorkflowApprovalEntity,
  WorkflowApprovalStatus,
} from '../entities/workflow-support.entity';

export class DecideApprovalDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Looks good, deal size confirmed.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class WorkflowApprovalResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() workflowRunId!: string;
  @ApiProperty() stepRunId!: string;
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] })
  status!: WorkflowApprovalStatus;
  @ApiPropertyOptional() approverUserId!: string | null;
  @ApiPropertyOptional() comment!: string | null;
  @ApiPropertyOptional() expiresAt!: string | null;
  @ApiPropertyOptional() decidedAt!: string | null;
  @ApiProperty() createdAt!: string;

  static fromEntity(entity: WorkflowApprovalEntity): WorkflowApprovalResponseDto {
    const dto = new WorkflowApprovalResponseDto();
    dto.id = entity.id;
    dto.workflowRunId = entity.workflowRunId;
    dto.stepRunId = entity.stepRunId;
    dto.status = entity.status;
    dto.approverUserId = entity.approverUserId;
    dto.comment = entity.comment;
    dto.expiresAt = entity.expiresAt ? entity.expiresAt.toISOString() : null;
    dto.decidedAt = entity.decidedAt ? entity.decidedAt.toISOString() : null;
    dto.createdAt = entity.createdAt.toISOString();
    return dto;
  }
}

export class WorkflowApprovalSuccessResponseDto extends ApiSuccessResponseDto<WorkflowApprovalResponseDto> {}
