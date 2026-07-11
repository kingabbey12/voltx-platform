import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateWorkflowTemplateDto,
  InstantiatedWorkflowSuccessResponseDto,
  InstantiateWorkflowTemplateDto,
  PaginatedWorkflowTemplatesResponseDto,
  WorkflowTemplateResponseDto,
  WorkflowTemplateSuccessResponseDto,
} from './dto/workflow-template.dto';
import { WorkflowResponseDto } from './dto/workflow.dto';
import { WorkflowTemplateService } from './workflow-template.service';

// Registered before WorkflowController in WorkflowModule — 'templates' as a
// literal path segment would otherwise be swallowed by WorkflowController's
// GET ':id' route, same reasoning as that controller's own 'dead-letters'
// ordering comment.
@ApiTags('Workflow Templates')
@ApiBearerAuth('JWT')
@Controller('workflows/templates')
export class WorkflowTemplateController {
  constructor(private readonly workflowTemplateService: WorkflowTemplateService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.template.manage')
  @ApiOperation({ summary: 'Create a custom workflow template' })
  @ApiCreatedResponse({ type: WorkflowTemplateSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async create(
    @Body() dto: CreateWorkflowTemplateDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<WorkflowTemplateResponseDto> {
    const template = await this.workflowTemplateService.create({ ...dto, createdBy: user.id });
    return WorkflowTemplateResponseDto.fromEntity(template);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'List workflow templates (system catalog + this org’s custom ones)' })
  @ApiOkResponse({ type: PaginatedWorkflowTemplatesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    const result = await this.workflowTemplateService.list({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      category,
    });
    return {
      ...result,
      items: result.items.map((item) => WorkflowTemplateResponseDto.fromEntity(item)),
    };
  }

  @Get(':key')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'Get a workflow template by key' })
  @ApiOkResponse({ type: WorkflowTemplateSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getByKey(@Param('key') key: string): Promise<WorkflowTemplateResponseDto> {
    const template = await this.workflowTemplateService.getByKey(key);
    return WorkflowTemplateResponseDto.fromEntity(template);
  }

  @Post(':key/instantiate')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.create')
  @ApiOperation({ summary: 'Create a real workflow (first draft version) from a template' })
  @ApiCreatedResponse({ type: InstantiatedWorkflowSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async instantiate(
    @Param('key') key: string,
    @Body() dto: InstantiateWorkflowTemplateDto,
  ): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowTemplateService.instantiate(key, dto.name);
    return WorkflowResponseDto.fromEntity(workflow);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.template.manage')
  @ApiOperation({
    summary: 'Delete a custom workflow template (system templates cannot be deleted)',
  })
  @ApiOkResponse({ type: WorkflowTemplateSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async remove(@Param('id') id: string): Promise<WorkflowTemplateResponseDto> {
    const template = await this.workflowTemplateService.remove(id);
    return WorkflowTemplateResponseDto.fromEntity(template);
  }
}
