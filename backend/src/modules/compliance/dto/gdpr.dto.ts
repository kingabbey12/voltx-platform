import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GdprRequestDto {
  @ApiProperty({ description: 'The platform User id this GDPR request targets.' })
  @IsUUID()
  userId!: string;
}

export class GdprExportSectionDto {
  @ApiProperty() model!: string;
  @ApiProperty() label!: string;
  @ApiProperty() rowCount!: number;
}

export class GdprExportResponseDto {
  @ApiProperty() organizationId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() exportedAt!: string;
  @ApiProperty() downloadUrl!: string;
  @ApiProperty() expiresAt!: string;
  @ApiProperty({ type: [GdprExportSectionDto] }) sections!: GdprExportSectionDto[];
  @ApiProperty({ type: [String] })
  excludedFromErasure!: string[];
}

export class GdprErasureOutcomeDto {
  @ApiProperty() model!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ enum: ['DELETE', 'ANONYMIZE', 'EXCLUDED'] }) action!: string;
  @ApiProperty() affected!: number;
  @ApiProperty({ required: false }) reason?: string;
}

export class GdprDeletionResponseDto {
  @ApiProperty() organizationId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ type: [GdprErasureOutcomeDto] }) results!: GdprErasureOutcomeDto[];
  @ApiProperty() globalIdentityScrubbed!: boolean;
}
