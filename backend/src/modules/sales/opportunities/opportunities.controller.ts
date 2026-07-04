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
  CreateOpportunityDto,
  ListOpportunitiesQueryDto,
  OpportunityInsightsSuccessResponseDto,
  OpportunityNextActionSuccessResponseDto,
  OpportunityResponseDto,
  OpportunitySuccessResponseDto,
  PaginatedOpportunitiesDto,
  PaginatedOpportunitiesSuccessResponseDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';
import { OpportunitiesService } from './opportunities.service';

@ApiTags('Sales Opportunities')
@ApiBearerAuth('JWT')
@Controller('sales/opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.opportunity.create')
  @ApiOperation({ summary: 'Create a sales opportunity' })
  @ApiCreatedResponse({ type: OpportunitySuccessResponseDto })
  create(@Body() dto: CreateOpportunityDto): Promise<OpportunityResponseDto> {
    return this.opportunitiesService.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.opportunity.read')
  @ApiOperation({ summary: 'List sales opportunities' })
  @ApiOkResponse({ type: PaginatedOpportunitiesSuccessResponseDto })
  findAll(@Query() query: ListOpportunitiesQueryDto): Promise<PaginatedOpportunitiesDto> {
    return this.opportunitiesService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      stage: query.stage,
      companyId: query.companyId,
      contactId: query.contactId,
      leadId: query.leadId,
    });
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.opportunity.read')
  @ApiOperation({ summary: 'Get a sales opportunity by id' })
  @ApiOkResponse({ type: OpportunitySuccessResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OpportunityResponseDto> {
    return this.opportunitiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.opportunity.update')
  @ApiOperation({ summary: 'Update a sales opportunity' })
  @ApiOkResponse({ type: OpportunitySuccessResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOpportunityDto,
  ): Promise<OpportunityResponseDto> {
    return this.opportunitiesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.opportunity.delete')
  @ApiOperation({ summary: 'Soft delete a sales opportunity' })
  @ApiOkResponse({ type: OpportunitySuccessResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<OpportunityResponseDto> {
    return this.opportunitiesService.remove(id);
  }

  @Post(':id/insights')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.ai.run')
  @ApiOperation({ summary: 'Generate AI opportunity insights' })
  @ApiOkResponse({ type: OpportunityInsightsSuccessResponseDto })
  insights(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalesAiActionDto,
  ): Promise<SalesAiActionResponseDto> {
    return this.opportunitiesService.insights(id, dto);
  }

  @Post(':id/next-best-action')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.ai.run')
  @ApiOperation({ summary: 'Generate AI next best action recommendation' })
  @ApiOkResponse({ type: OpportunityNextActionSuccessResponseDto })
  nextBestAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalesAiActionDto,
  ): Promise<SalesAiActionResponseDto> {
    return this.opportunitiesService.nextBestAction(id, dto);
  }
}
