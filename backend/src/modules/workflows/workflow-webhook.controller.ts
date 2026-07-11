import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  SetWorkflowWebhookEnabledDto,
  WorkflowWebhookCreatedResponseDto,
  WorkflowWebhookCreatedSuccessResponseDto,
  WorkflowWebhookListSuccessResponseDto,
  WorkflowWebhookResponseDto,
  WorkflowWebhookSuccessResponseDto,
} from './dto/workflow-webhook.dto';
import { WorkflowWebhookService } from './workflow-webhook.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * All routes here are at least three path segments under 'workflows'
 * (:id/webhooks, webhooks/:webhookId, webhooks/:token), so none collide
 * with WorkflowController's two-segment ':id' route — no registration-
 * order dependency, unlike WorkflowTemplateController/
 * WorkflowSecretController/the org-level half of
 * WorkflowVariableController.
 */
@ApiTags('Workflow Webhooks')
@Controller('workflows')
export class WorkflowWebhookController {
  constructor(private readonly workflowWebhookService: WorkflowWebhookService) {}

  @Post(':id/webhooks')
  @ApiBearerAuth('JWT')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.webhook.manage')
  @ApiOperation({
    summary:
      'Register an inbound webhook that starts a run — the secret is returned once, here only',
  })
  @ApiCreatedResponse({ type: WorkflowWebhookCreatedSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async create(@Param('id') workflowId: string): Promise<WorkflowWebhookCreatedResponseDto> {
    const { webhook, secret } = await this.workflowWebhookService.create(workflowId);
    const dto = WorkflowWebhookResponseDto.fromEntity(webhook) as WorkflowWebhookCreatedResponseDto;
    dto.secret = secret;
    return dto;
  }

  @Get(':id/webhooks')
  @ApiBearerAuth('JWT')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.webhook.manage')
  @ApiOperation({ summary: 'List a workflow’s registered webhooks' })
  @ApiOkResponse({ type: WorkflowWebhookListSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async list(@Param('id') workflowId: string): Promise<WorkflowWebhookResponseDto[]> {
    const webhooks = await this.workflowWebhookService.list(workflowId);
    return webhooks.map((webhook) => WorkflowWebhookResponseDto.fromEntity(webhook));
  }

  @Patch('webhooks/:webhookId')
  @ApiBearerAuth('JWT')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.webhook.manage')
  @ApiOperation({ summary: 'Enable or disable a workflow webhook' })
  @ApiOkResponse({ type: WorkflowWebhookSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async setEnabled(
    @Param('webhookId') webhookId: string,
    @Body() dto: SetWorkflowWebhookEnabledDto,
  ): Promise<WorkflowWebhookResponseDto> {
    const webhook = await this.workflowWebhookService.setEnabled(webhookId, dto.enabled);
    return WorkflowWebhookResponseDto.fromEntity(webhook);
  }

  @Delete('webhooks/:webhookId')
  @ApiBearerAuth('JWT')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.webhook.manage')
  @ApiOperation({ summary: 'Delete a workflow webhook' })
  @ApiOkResponse({ type: WorkflowWebhookSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async remove(@Param('webhookId') webhookId: string): Promise<WorkflowWebhookResponseDto> {
    const webhook = await this.workflowWebhookService.remove(webhookId);
    return WorkflowWebhookResponseDto.fromEntity(webhook);
  }

  /**
   * The public inbound receiver — no bearer token (the caller is
   * external), identity/tenant scoping comes entirely from the
   * unguessable token, and the HMAC signature proves the request is
   * authorized. Mirrors IntegrationWebhookReceiverController's contract.
   */
  @Post('webhooks/:token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inbound webhook receiver — starts a workflow run' })
  async receive(
    @Param('token') token: string,
    @Headers('x-workflow-signature') signature: string | undefined,
    @Req() request: RequestWithRawBody,
  ): Promise<{ received: boolean; runId: string }> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    return this.workflowWebhookService.receive(token, signature, rawBody);
  }
}
