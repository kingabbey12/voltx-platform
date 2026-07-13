import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { WebhookEndpointStatus } from '@prisma/client';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateWebhookEndpointDto,
  CreateWebhookEndpointResponseDto,
  RotateWebhookEndpointSecretResponseDto,
  UpdateWebhookEndpointDto,
  WebhookEndpointResponseDto,
} from './dto/webhook-endpoint.dto';
import { WebhookDeliveryResponseDto } from './dto/webhook-delivery.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { WebhookEndpointService } from './webhook-endpoint.service';

class WebhookEndpointSuccessResponseDto extends ApiSuccessResponseDto<CreateWebhookEndpointResponseDto> {}
class WebhookEndpointDetailSuccessResponseDto extends ApiSuccessResponseDto<WebhookEndpointResponseDto> {}
class WebhookEndpointListSuccessResponseDto extends ApiSuccessResponseDto<
  WebhookEndpointResponseDto[]
> {}
class RotateWebhookEndpointSecretSuccessResponseDto extends ApiSuccessResponseDto<RotateWebhookEndpointSecretResponseDto> {}
class WebhookDeliveryListSuccessResponseDto extends ApiSuccessResponseDto<
  WebhookDeliveryResponseDto[]
> {}
class WebhookDeliverySuccessResponseDto extends ApiSuccessResponseDto<WebhookDeliveryResponseDto> {}

@ApiTags('Developer Platform — Webhooks')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/webhook-endpoints')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class WebhookEndpointController {
  constructor(private readonly service: WebhookEndpointService) {}

  @Post()
  @Permissions('developer_platform.webhook_endpoint.manage')
  @ApiOperation({ summary: 'Register a new webhook endpoint' })
  @ApiCreatedResponse({
    description: 'Webhook endpoint registered',
    type: WebhookEndpointSuccessResponseDto,
  })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreateWebhookEndpointDto,
  ): Promise<CreateWebhookEndpointResponseDto> {
    return this.service.create(organizationId, user.id, dto);
  }

  @Get()
  @Permissions('developer_platform.webhook_endpoint.read')
  @ApiOperation({ summary: "List the organization's webhook endpoints" })
  @ApiOkResponse({ description: 'Webhook endpoints', type: WebhookEndpointListSuccessResponseDto })
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<WebhookEndpointResponseDto[]> {
    return this.service.list(organizationId);
  }

  @Get(':id')
  @Permissions('developer_platform.webhook_endpoint.read')
  @ApiOperation({ summary: 'Get a webhook endpoint by id' })
  @ApiOkResponse({ description: 'Webhook endpoint', type: WebhookEndpointDetailSuccessResponseDto })
  getOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebhookEndpointResponseDto> {
    return this.service.getOrThrow(id, organizationId);
  }

  @Patch(':id')
  @Permissions('developer_platform.webhook_endpoint.manage')
  @ApiOperation({
    summary: 'Update a webhook endpoint (url, description, or subscribed event types)',
  })
  @ApiOkResponse({
    description: 'Webhook endpoint updated',
    type: WebhookEndpointDetailSuccessResponseDto,
  })
  update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpointResponseDto> {
    return this.service.update(id, organizationId, dto);
  }

  @Post(':id/rotate-secret')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.webhook_endpoint.manage')
  @ApiOperation({
    summary: "Rotate a webhook endpoint's signing secret",
    description: 'The full new secret is returned exactly once in this response and never again.',
  })
  @ApiOkResponse({
    description: 'Signing secret rotated',
    type: RotateWebhookEndpointSecretSuccessResponseDto,
  })
  rotateSecret(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RotateWebhookEndpointSecretResponseDto> {
    return this.service.rotateSecret(id, organizationId);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.webhook_endpoint.manage')
  @ApiOperation({
    summary: 'Suspend a webhook endpoint (it stops receiving deliveries immediately)',
  })
  @ApiOkResponse({
    description: 'Webhook endpoint suspended',
    type: WebhookEndpointDetailSuccessResponseDto,
  })
  suspend(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebhookEndpointResponseDto> {
    return this.service.setStatus(id, organizationId, WebhookEndpointStatus.SUSPENDED);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.webhook_endpoint.manage')
  @ApiOperation({ summary: 'Reactivate a suspended webhook endpoint' })
  @ApiOkResponse({
    description: 'Webhook endpoint reactivated',
    type: WebhookEndpointDetailSuccessResponseDto,
  })
  reactivate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebhookEndpointResponseDto> {
    return this.service.setStatus(id, organizationId, WebhookEndpointStatus.ACTIVE);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.webhook_endpoint.manage')
  @ApiOperation({ summary: 'Delete a webhook endpoint (and its delivery history)' })
  @ApiOkResponse({ description: 'Webhook endpoint deleted' })
  async delete(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.delete(id, organizationId);
    return { message: 'Webhook endpoint deleted' };
  }

  @Get(':id/deliveries')
  @Permissions('developer_platform.webhook_endpoint.read')
  @ApiOperation({ summary: "List a webhook endpoint's delivery log" })
  @ApiOkResponse({ description: 'Webhook deliveries', type: WebhookDeliveryListSuccessResponseDto })
  listDeliveries(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebhookDeliveryResponseDto[]> {
    return this.service.listDeliveries(id, organizationId);
  }

  @Post(':id/deliveries/:deliveryId/replay')
  @Permissions('developer_platform.webhook_endpoint.manage')
  @ApiOperation({
    summary: 'Replay a webhook delivery',
    description:
      'Creates and enqueues a brand-new delivery for the same event — the original delivery log row is left untouched.',
  })
  @ApiCreatedResponse({
    description: 'Replay delivery created',
    type: WebhookDeliverySuccessResponseDto,
  })
  replayDelivery(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ): Promise<WebhookDeliveryResponseDto> {
    return this.service.replayDelivery(id, deliveryId, organizationId);
  }
}
