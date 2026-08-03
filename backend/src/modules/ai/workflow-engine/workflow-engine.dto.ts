import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  StoredWorkflowPlan,
  WorkflowPlanHandoffResult,
  WorkflowPlansResult,
} from './workflow-engine.types';

export class WorkflowPlansResponseDto implements WorkflowPlansResult {
  planSetVersion!: '1.0';
  generatedAt!: string;
  tenantId!: string;
  userId!: string;
  plans!: WorkflowPlansResult['plans'];
  excludedSources!: WorkflowPlansResult['excludedSources'];
  decisionsConsidered!: number;
  plansGenerated!: number;
}

export class WorkflowPlanResponseDto implements StoredWorkflowPlan {
  id!: string;
  tenantId!: string;
  userId!: string;
  planKey!: string;
  planVersion!: string;
  plan!: StoredWorkflowPlan['plan'];
  status!: StoredWorkflowPlan['status'];
  approvalId!: string | null;
  workflowId!: string | null;
  workflowExecutionId!: string | null;
  createdAt!: string;
  updatedAt!: string;
  expiresAt!: string;
  approvedAt!: string | null;
  rejectedAt!: string | null;
  handedOffAt!: string | null;
}

export class WorkflowPlanHandoffResponseDto implements WorkflowPlanHandoffResult {
  planId!: string;
  status!: WorkflowPlanHandoffResult['status'];
  workflowId!: string;
  workflowExecutionId!: string;
  handedOffAt!: string;
  idempotentReplay!: boolean;
}

export class GenerateWorkflowPlansDto {
  @ApiPropertyOptional({
    description: 'What the plan set is for. Recorded and echoed; never used to widen access.',
    example: "Create a plan for today's priorities.",
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  objective?: string;
}

export class HandOffWorkflowPlanDto {
  @ApiProperty({
    description: 'The plan version the approver saw. A mismatch rejects the handoff.',
    example: '1.0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  planVersion?: string;
}
