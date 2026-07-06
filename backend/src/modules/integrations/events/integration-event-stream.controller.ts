import { Controller, Get, HttpCode, HttpStatus, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { writeEventStreamToResponse } from '../../ai/streaming/write-event-stream-to-response';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { IntegrationEventStreamService } from './integration-event-stream.service';

@ApiTags('Integrations')
@ApiBearerAuth('JWT')
@Controller('integrations/events')
export class IntegrationEventStreamController {
  constructor(
    private readonly integrationEventStreamService: IntegrationEventStreamService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  @Get('stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.read')
  @ApiOperation({
    summary: 'Stream every integration event for this organization in real time (SSE)',
  })
  @ApiProduces('text/event-stream')
  async stream(@Res() response: Response): Promise<void> {
    const organizationId = this.tenantContextService.getOrThrow().organizationId;
    await writeEventStreamToResponse(response, (signal) =>
      this.integrationEventStreamService.streamForOrganization(organizationId, signal),
    );
  }
}
