import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditExportFormat } from '@prisma/client';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import {
  AuditChainVerifyResponseDto,
  AuditExportResponseDto,
  CreateAuditExportDto,
} from '../dto/audit-compliance.dto';
import { AuditComplianceService } from './audit-compliance.service';

@ApiTags('Compliance — Audit')
@ApiBearerAuth('JWT')
@Controller('compliance/audit')
export class AuditComplianceController {
  constructor(private readonly auditComplianceService: AuditComplianceService) {}

  @Post('export')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.audit.export')
  @ApiOperation({
    summary: "Export this organization's audit log for a date range to a downloadable file",
  })
  async createExport(@Body() dto: CreateAuditExportDto): Promise<AuditExportResponseDto> {
    const { auditExport, downloadUrl } = await this.auditComplianceService.createExport(
      dto.fromDate,
      dto.toDate,
      dto.format ?? AuditExportFormat.JSON,
    );
    return AuditExportResponseDto.fromModel(auditExport, downloadUrl);
  }

  @Get('export/:id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.audit.export')
  @ApiOperation({
    summary: 'Get the status and a fresh signed download URL for a previous audit export',
  })
  async getExport(@Param('id', ParseUUIDPipe) id: string): Promise<AuditExportResponseDto> {
    const { auditExport, downloadUrl } = await this.auditComplianceService.getExport(id);
    return AuditExportResponseDto.fromModel(auditExport, downloadUrl);
  }

  @Get('verify')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.audit.verify')
  @ApiOperation({
    summary:
      "Walk this organization's audit-log hash chain and report whether it is intact, or the index of the first tampered/broken row",
  })
  async verify(): Promise<AuditChainVerifyResponseDto> {
    return this.auditComplianceService.verifyChain();
  }
}
