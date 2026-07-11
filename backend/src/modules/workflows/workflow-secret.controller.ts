import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
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
  CreateWorkflowSecretDto,
  RotateWorkflowSecretDto,
  WorkflowSecretListSuccessResponseDto,
  WorkflowSecretResponseDto,
  WorkflowSecretSuccessResponseDto,
} from './dto/workflow-secret.dto';
import { WorkflowSecretService } from './workflow-secret.service';

// Registered before WorkflowController in WorkflowModule — see
// WorkflowTemplateController's identical ordering note.
@ApiTags('Workflow Secrets')
@ApiBearerAuth('JWT')
@Controller('workflows/secrets')
export class WorkflowSecretController {
  constructor(private readonly workflowSecretService: WorkflowSecretService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.secret.manage')
  @ApiOperation({ summary: 'Create an org-scoped encrypted secret workflows can reference' })
  @ApiCreatedResponse({ type: WorkflowSecretSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async create(
    @Body() dto: CreateWorkflowSecretDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<WorkflowSecretResponseDto> {
    const secret = await this.workflowSecretService.create({ ...dto, createdBy: user.id });
    return WorkflowSecretResponseDto.fromEntity(secret);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.secret.manage')
  @ApiOperation({ summary: 'List workflow secrets (metadata only — values are never returned)' })
  @ApiOkResponse({ type: WorkflowSecretListSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async list(): Promise<WorkflowSecretResponseDto[]> {
    const secrets = await this.workflowSecretService.list();
    return secrets.map((secret) => WorkflowSecretResponseDto.fromEntity(secret));
  }

  @Post(':id/rotate')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.secret.manage')
  @ApiOperation({ summary: 'Rotate a secret’s value (the old value is immediately discarded)' })
  @ApiCreatedResponse({ type: WorkflowSecretSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async rotate(
    @Param('id') id: string,
    @Body() dto: RotateWorkflowSecretDto,
  ): Promise<WorkflowSecretResponseDto> {
    const secret = await this.workflowSecretService.rotate(id, dto.value);
    return WorkflowSecretResponseDto.fromEntity(secret);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.secret.manage')
  @ApiOperation({ summary: 'Delete a workflow secret' })
  @ApiOkResponse({ type: WorkflowSecretSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async remove(@Param('id') id: string): Promise<WorkflowSecretResponseDto> {
    const secret = await this.workflowSecretService.remove(id);
    return WorkflowSecretResponseDto.fromEntity(secret);
  }
}
