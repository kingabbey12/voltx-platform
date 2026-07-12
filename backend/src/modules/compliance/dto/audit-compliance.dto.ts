import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { AuditExport, AuditExportFormat } from '@prisma/client';

export class CreateAuditExportDto {
  @ApiProperty()
  @IsDateString()
  fromDate!: string;

  @ApiProperty()
  @IsDateString()
  toDate!: string;

  @ApiPropertyOptional({ enum: AuditExportFormat, default: AuditExportFormat.JSON })
  @IsOptional()
  @IsEnum(AuditExportFormat)
  format?: AuditExportFormat;
}

export class AuditExportResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
  @ApiProperty({ enum: AuditExportFormat }) format!: AuditExportFormat;
  @ApiProperty() fromDate!: string;
  @ApiProperty() toDate!: string;
  @ApiPropertyOptional({ nullable: true }) rowCount!: number | null;
  @ApiPropertyOptional({ nullable: true }) downloadUrl!: string | null;
  @ApiPropertyOptional({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() createdAt!: string;

  static fromModel(model: AuditExport, downloadUrl: string | null): AuditExportResponseDto {
    const dto = new AuditExportResponseDto();
    dto.id = model.id;
    dto.status = model.status;
    dto.format = model.format;
    dto.fromDate = model.fromDate.toISOString();
    dto.toDate = model.toDate.toISOString();
    dto.rowCount = model.rowCount;
    dto.downloadUrl = downloadUrl;
    dto.errorMessage = model.errorMessage;
    dto.createdAt = model.createdAt.toISOString();
    return dto;
  }
}

export class AuditChainVerifyResponseDto {
  @ApiProperty() valid!: boolean;
  @ApiProperty() checked!: number;
  @ApiPropertyOptional({ nullable: true }) brokenAtIndex!: number | null;
  @ApiPropertyOptional({ nullable: true }) brokenAuditLogId!: string | null;
}
