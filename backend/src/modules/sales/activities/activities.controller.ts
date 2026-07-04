import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { SalesAiActionDto, SalesAiActionResponseDto } from '../dto/sales-ai.dto';
import {
  ActivityResponseDto,
  ActivitySuccessResponseDto,
  CreateActivityDto,
  ListActivitiesQueryDto,
  MeetingSummarySuccessResponseDto,
  PaginatedActivitiesDto,
  PaginatedActivitiesSuccessResponseDto,
  UpdateActivityDto,
} from './dto/activity.dto';
import { ActivitiesService } from './activities.service';

@ApiTags('Sales Activities')
@ApiBearerAuth('JWT')
@Controller('sales/activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.activity.create')
  @ApiOperation({ summary: 'Create a sales activity' })
  @ApiCreatedResponse({ type: ActivitySuccessResponseDto })
  create(@Body() dto: CreateActivityDto): Promise<ActivityResponseDto> {
    return this.activitiesService.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.activity.read')
  @ApiOperation({ summary: 'List sales activities' })
  @ApiOkResponse({ type: PaginatedActivitiesSuccessResponseDto })
  findAll(@Query() query: ListActivitiesQueryDto): Promise<PaginatedActivitiesDto> {
    return this.activitiesService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      type: query.type,
      completed: query.completed,
      companyId: query.companyId,
      contactId: query.contactId,
      leadId: query.leadId,
      opportunityId: query.opportunityId,
    });
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.activity.read')
  @ApiOperation({ summary: 'Get a sales activity by id' })
  @ApiOkResponse({ type: ActivitySuccessResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ActivityResponseDto> {
    return this.activitiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.activity.update')
  @ApiOperation({ summary: 'Update a sales activity' })
  @ApiOkResponse({ type: ActivitySuccessResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActivityDto,
  ): Promise<ActivityResponseDto> {
    return this.activitiesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.activity.delete')
  @ApiOperation({ summary: 'Soft delete a sales activity' })
  @ApiOkResponse({ type: ActivitySuccessResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<ActivityResponseDto> {
    return this.activitiesService.remove(id);
  }

  @Post(':id/meeting-summary')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.ai.run')
  @ApiOperation({ summary: 'Generate an AI meeting summary' })
  @ApiOkResponse({ type: MeetingSummarySuccessResponseDto })
  meetingSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalesAiActionDto,
  ): Promise<SalesAiActionResponseDto> {
    return this.activitiesService.summarizeMeeting(id, dto);
  }
}
