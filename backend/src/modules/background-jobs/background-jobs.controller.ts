import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { BackgroundJobFailureService } from './background-job-failure.service';
import {
  BackgroundJobFailureResponseDto,
  BackgroundJobFailuresSuccessResponseDto,
  ListBackgroundJobFailuresQueryDto,
  PaginatedBackgroundJobFailuresDto,
} from './dto/background-job-failure.dto';

@ApiTags('Operations')
@ApiBearerAuth('JWT')
@Controller('ops/dead-letters')
export class BackgroundJobsController {
  constructor(private readonly backgroundJobFailureService: BackgroundJobFailureService) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ops.dead_letter.read')
  @ApiOperation({
    summary:
      'List background jobs (comms AI processing, attachment processing, AI agent-run resume) that exhausted their retry attempts',
  })
  @ApiOkResponse({ type: BackgroundJobFailuresSuccessResponseDto })
  async list(
    @Query() query: ListBackgroundJobFailuresQueryDto,
  ): Promise<PaginatedBackgroundJobFailuresDto> {
    const result = await this.backgroundJobFailureService.listForCurrentOrganization(
      query.page ?? 1,
      query.limit ?? 20,
    );
    return {
      items: result.items.map((item) => BackgroundJobFailureResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
