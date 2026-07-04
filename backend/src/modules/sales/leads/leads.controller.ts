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
  CreateLeadDto,
  LeadQualificationSuccessResponseDto,
  LeadResponseDto,
  LeadSuccessResponseDto,
  ListLeadsQueryDto,
  PaginatedLeadsDto,
  PaginatedLeadsSuccessResponseDto,
  UpdateLeadDto,
} from './dto/lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('Sales Leads')
@ApiBearerAuth('JWT')
@Controller('sales/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.lead.create')
  @ApiOperation({ summary: 'Create a sales lead' })
  @ApiCreatedResponse({ type: LeadSuccessResponseDto })
  create(@Body() dto: CreateLeadDto): Promise<LeadResponseDto> {
    return this.leadsService.create(dto);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.lead.read')
  @ApiOperation({ summary: 'List sales leads' })
  @ApiOkResponse({ type: PaginatedLeadsSuccessResponseDto })
  findAll(@Query() query: ListLeadsQueryDto): Promise<PaginatedLeadsDto> {
    return this.leadsService.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      search: query.search,
      status: query.status,
      companyId: query.companyId,
      contactId: query.contactId,
    });
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.lead.read')
  @ApiOperation({ summary: 'Get a sales lead by id' })
  @ApiOkResponse({ type: LeadSuccessResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<LeadResponseDto> {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.lead.update')
  @ApiOperation({ summary: 'Update a sales lead' })
  @ApiOkResponse({ type: LeadSuccessResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ): Promise<LeadResponseDto> {
    return this.leadsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.lead.delete')
  @ApiOperation({ summary: 'Soft delete a sales lead' })
  @ApiOkResponse({ type: LeadSuccessResponseDto })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<LeadResponseDto> {
    return this.leadsService.remove(id);
  }

  @Post(':id/qualify')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('sales.ai.run')
  @ApiOperation({ summary: 'Run AI lead qualification' })
  @ApiOkResponse({ type: LeadQualificationSuccessResponseDto })
  qualify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalesAiActionDto,
  ): Promise<SalesAiActionResponseDto> {
    return this.leadsService.qualify(id, dto);
  }
}
