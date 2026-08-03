import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BusinessIntelligenceEvidenceDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['critical', 'high', 'medium', 'low'] }) priority!: string;
  @ApiPropertyOptional() occurredAt?: string;
}

export class BusinessIntelligenceScoreDto {
  @ApiProperty() id!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ enum: ['healthy', 'watch', 'at_risk', 'unavailable'] }) status!: string;
  @ApiProperty({ nullable: true }) score!: number | null;
  @ApiProperty({ enum: ['high', 'medium', 'low'] }) confidence!: string;
  @ApiProperty() formulaVersion!: string;
  @ApiProperty() formula!: string;
  @ApiProperty({ additionalProperties: { type: 'number' } }) weights!: Record<string, number>;
  @ApiProperty({ additionalProperties: { type: 'number' } }) inputs!: Record<string, number>;
  @ApiProperty({ type: [BusinessIntelligenceEvidenceDto] })
  evidence!: BusinessIntelligenceEvidenceDto[];
  @ApiProperty({ type: [String] }) sourceModules!: string[];
  @ApiProperty({ type: [Object] }) excludedSources!: Array<{ source: string; reason: string }>;
  @ApiProperty() reasoning!: string;
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ enum: ['unavailable'] }) trendStatus!: 'unavailable';
  @ApiProperty({ enum: ['historical_source_unavailable'] })
  trendReason!: 'historical_source_unavailable';
}

export class BusinessIntelligenceResponseDto {
  @ApiProperty() version!: '1.0';
  @ApiProperty() generatedAt!: string;
  @ApiProperty({ type: BusinessIntelligenceScoreDto })
  executiveHealth!: BusinessIntelligenceScoreDto;
  @ApiProperty({ type: [BusinessIntelligenceScoreDto] })
  departments!: BusinessIntelligenceScoreDto[];
}
