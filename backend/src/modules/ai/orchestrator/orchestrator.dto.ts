import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { OrchestrationResult } from './orchestrator.types';

export class OrchestrateDto {
  @ApiProperty({
    description: 'The business question to coordinate agents around.',
    example: 'Coordinate sales and finance for this week.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  objective!: string;
}

export class OrchestrationResponseDto implements OrchestrationResult {
  orchestrationVersion!: '1.0';
  generatedAt!: string;
  tenantId!: string;
  userId!: string;
  objective!: string;
  routing!: OrchestrationResult['routing'];
  agents!: OrchestrationResult['agents'];
  recommendations!: OrchestrationResult['recommendations'];
  evidence!: OrchestrationResult['evidence'];
  decisionIds!: string[];
  insightIds!: string[];
  conflicts!: OrchestrationResult['conflicts'];
  consensus!: OrchestrationResult['consensus'];
  priority!: OrchestrationResult['priority'];
  businessImpact!: OrchestrationResult['businessImpact'];
  confidence!: OrchestrationResult['confidence'];
  approvalRequired!: boolean;
  sourcesUsed!: OrchestrationResult['sourcesUsed'];
  excludedSources!: OrchestrationResult['excludedSources'];
  executionMs!: number;
  mergeMs!: number;
  partialFailure!: boolean;
}
