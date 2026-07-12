import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { GdprDeletionResponseDto, GdprExportResponseDto, GdprRequestDto } from '../dto/gdpr.dto';
import { GdprService } from './gdpr.service';

@ApiTags('Compliance — GDPR')
@ApiBearerAuth('JWT')
@Controller('compliance/gdpr')
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Post('export')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.gdpr.manage')
  @ApiOperation({
    summary:
      "Export all of a member's personal data held by this organization (GDPR data portability)",
  })
  async export(@Body() dto: GdprRequestDto): Promise<GdprExportResponseDto> {
    return this.gdprService.exportUserData(dto.userId);
  }

  @Post('delete')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('compliance.gdpr.manage')
  @ApiOperation({
    summary:
      "Erase a member's personal data held by this organization (GDPR right to erasure) — blocked by an active legal hold",
  })
  async delete(@Body() dto: GdprRequestDto): Promise<GdprDeletionResponseDto> {
    return this.gdprService.deleteUserData(dto.userId);
  }
}
