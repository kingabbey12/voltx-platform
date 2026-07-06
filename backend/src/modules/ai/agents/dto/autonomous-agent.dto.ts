import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RunAutonomousAgentDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  conversationId!: string;

  @ApiProperty({
    example: 'Research the top 3 blockers reported this week and draft a mitigation summary.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  objective!: string;

  @ApiPropertyOptional({ type: [String], example: ['Region: us-east-1', 'Audience: CTO'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  workspaceContext?: string[];

  @ApiPropertyOptional({ example: 0.2, minimum: 0, maximum: 2 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ example: 2048, minimum: 1, maximum: 32768 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(32768)
  maxOutputTokens?: number;

  @ApiPropertyOptional({
    example: 8,
    minimum: 1,
    maximum: 25,
    description: 'Overrides the configured default.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  maxIterations?: number;

  @ApiPropertyOptional({
    example: 12,
    minimum: 1,
    maximum: 40,
    description: 'Overrides the configured default.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  maxToolCalls?: number;

  @ApiPropertyOptional({
    example: 120000,
    minimum: 1000,
    maximum: 600000,
    description: 'Overrides the configured default.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  @Max(600000)
  timeoutMs?: number;
}
