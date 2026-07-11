import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateWorkflowVariableDto,
  UpdateWorkflowVariableDto,
  WorkflowVariableListSuccessResponseDto,
  WorkflowVariableResponseDto,
  WorkflowVariableSuccessResponseDto,
} from './dto/workflow-variable.dto';
import { WorkflowVariableService } from './workflow-variable.service';

// Registered before WorkflowController in WorkflowModule — the bare
// GET/POST 'variables' routes below would otherwise be swallowed by
// WorkflowController's GET ':id' route, same reasoning as
// WorkflowTemplateController's ordering note. The `:id/variables` routes
// don't have this problem (three path segments never collide with
// WorkflowController's two-segment ':id' route) but live here too for
// one cohesive controller.
@ApiTags('Workflow Variables')
@ApiBearerAuth('JWT')
@Controller('workflows')
export class WorkflowVariableController {
  constructor(private readonly workflowVariableService: WorkflowVariableService) {}

  @Post('variables')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.variable.manage')
  @ApiOperation({ summary: 'Create an org-level shared workflow variable' })
  @ApiCreatedResponse({ type: WorkflowVariableSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async createOrgVariable(
    @Body() dto: CreateWorkflowVariableDto,
  ): Promise<WorkflowVariableResponseDto> {
    const variable = await this.workflowVariableService.create({ ...dto, workflowId: null });
    return WorkflowVariableResponseDto.fromEntity(variable);
  }

  @Get('variables')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'List org-level shared workflow variables' })
  @ApiOkResponse({ type: WorkflowVariableListSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listOrgVariables(): Promise<WorkflowVariableResponseDto[]> {
    const variables = await this.workflowVariableService.list(null);
    return variables.map((variable) => WorkflowVariableResponseDto.fromEntity(variable));
  }

  @Post(':id/variables')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.variable.manage')
  @ApiOperation({ summary: 'Create a variable scoped to one workflow' })
  @ApiCreatedResponse({ type: WorkflowVariableSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async createWorkflowVariable(
    @Param('id') workflowId: string,
    @Body() dto: CreateWorkflowVariableDto,
  ): Promise<WorkflowVariableResponseDto> {
    const variable = await this.workflowVariableService.create({ ...dto, workflowId });
    return WorkflowVariableResponseDto.fromEntity(variable);
  }

  @Get(':id/variables')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'List a workflow’s own variables plus every org-level one' })
  @ApiOkResponse({ type: WorkflowVariableListSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listWorkflowVariables(
    @Param('id') workflowId: string,
  ): Promise<WorkflowVariableResponseDto[]> {
    const variables = await this.workflowVariableService.list(workflowId);
    return variables.map((variable) => WorkflowVariableResponseDto.fromEntity(variable));
  }

  @Patch('variables/:variableId')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.variable.manage')
  @ApiOperation({ summary: 'Update a workflow variable' })
  @ApiOkResponse({ type: WorkflowVariableSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async update(
    @Param('variableId') variableId: string,
    @Body() dto: UpdateWorkflowVariableDto,
  ): Promise<WorkflowVariableResponseDto> {
    const variable = await this.workflowVariableService.update(variableId, dto);
    return WorkflowVariableResponseDto.fromEntity(variable);
  }

  @Delete('variables/:variableId')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.variable.manage')
  @ApiOperation({ summary: 'Delete a workflow variable' })
  @ApiOkResponse({ type: WorkflowVariableSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async remove(@Param('variableId') variableId: string): Promise<WorkflowVariableResponseDto> {
    const variable = await this.workflowVariableService.remove(variableId);
    return WorkflowVariableResponseDto.fromEntity(variable);
  }
}
