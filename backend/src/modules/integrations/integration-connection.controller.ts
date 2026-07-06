import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CompleteOAuthDto,
  CreateApiKeyConnectionDto,
  InitiateOAuthDto,
  InitiateOAuthSuccessResponseDto,
  IntegrationConnectionResponseDto,
  IntegrationConnectionSuccessResponseDto,
  IntegrationHealthSuccessResponseDto,
  IntegrationSyncResultSuccessResponseDto,
  ListConnectionsQueryDto,
  PaginatedIntegrationConnectionsResponseDto,
  ReconnectDto,
  RegisterWebhookDto,
  RegisterWebhookSuccessResponseDto,
  UpdateConnectionDto,
} from './connections/dto/integration-connection.dto';
import {
  IntegrationApiUsageLogResponseDto,
  IntegrationEventResponseDto,
  IntegrationMetricsDto,
  IntegrationMetricsSuccessResponseDto,
  IntegrationSyncRunResponseDto,
  ListPageQueryDto,
  PaginatedIntegrationApiUsageLogsResponseDto,
  PaginatedIntegrationEventsResponseDto,
  PaginatedIntegrationSyncRunsResponseDto,
} from './connections/dto/integration-observability.dto';
import { IntegrationConnectionService } from './integration-connection.service';
import { IntegrationStatsService } from './observability/integration-stats.service';

@ApiTags('Integrations')
@ApiBearerAuth('JWT')
@Controller('integrations/connections')
export class IntegrationConnectionController {
  constructor(
    private readonly integrationConnectionService: IntegrationConnectionService,
    private readonly integrationStatsService: IntegrationStatsService,
  ) {}

  @Post('oauth/initiate')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.create')
  @ApiOperation({ summary: 'Start an OAuth2 connection — returns the provider authorization URL' })
  @ApiCreatedResponse({ type: InitiateOAuthSuccessResponseDto })
  initiateOAuth(@Body() dto: InitiateOAuthDto) {
    return this.integrationConnectionService.initiateOAuth(dto);
  }

  @Post('oauth/complete')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.create')
  @ApiOperation({ summary: 'Complete an OAuth2 connection using the authorization code' })
  @ApiCreatedResponse({ type: IntegrationConnectionSuccessResponseDto })
  async completeOAuth(@Body() dto: CompleteOAuthDto): Promise<IntegrationConnectionResponseDto> {
    const connection = await this.integrationConnectionService.completeOAuth(dto);
    return IntegrationConnectionResponseDto.fromEntity(connection);
  }

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.create')
  @ApiOperation({
    summary:
      'Create a connection for an API-key/webhook-secret/no-auth provider (e.g. Stripe, generic webhook)',
  })
  @ApiCreatedResponse({ type: IntegrationConnectionSuccessResponseDto })
  async create(@Body() dto: CreateApiKeyConnectionDto): Promise<IntegrationConnectionResponseDto> {
    const connection = await this.integrationConnectionService.createApiKeyConnection(dto);
    return IntegrationConnectionResponseDto.fromEntity(connection);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.read')
  @ApiOperation({ summary: 'List integration connections' })
  @ApiOkResponse({ type: PaginatedIntegrationConnectionsResponseDto })
  async list(@Query() query: ListConnectionsQueryDto) {
    const result = await this.integrationConnectionService.listConnections({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      provider: query.provider,
      status: query.status,
    });
    return {
      ...result,
      items: result.items.map((item) => IntegrationConnectionResponseDto.fromEntity(item)),
    };
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.read')
  @ApiOperation({ summary: 'Get an integration connection' })
  @ApiOkResponse({ type: IntegrationConnectionSuccessResponseDto })
  async getById(@Param('id') id: string): Promise<IntegrationConnectionResponseDto> {
    const connection = await this.integrationConnectionService.getConnectionOrThrow(id);
    return IntegrationConnectionResponseDto.fromEntity(connection);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.update')
  @ApiOperation({ summary: "Update a connection's display name/config" })
  @ApiOkResponse({ type: IntegrationConnectionSuccessResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateConnectionDto,
  ): Promise<IntegrationConnectionResponseDto> {
    const connection = await this.integrationConnectionService.updateConnection(id, dto);
    return IntegrationConnectionResponseDto.fromEntity(connection);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.delete')
  @ApiOperation({ summary: 'Soft-delete a connection (and its stored credential)' })
  @ApiOkResponse()
  async remove(@Param('id') id: string): Promise<{ deleted: boolean }> {
    await this.integrationConnectionService.deleteConnection(id);
    return { deleted: true };
  }

  @Post(':id/revoke')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.update')
  @ApiOperation({
    summary: "Revoke a connection's credential without deleting the connection record",
  })
  @ApiCreatedResponse({ type: IntegrationConnectionSuccessResponseDto })
  async revoke(@Param('id') id: string): Promise<IntegrationConnectionResponseDto> {
    const connection = await this.integrationConnectionService.revokeConnection(id);
    return IntegrationConnectionResponseDto.fromEntity(connection);
  }

  @Post(':id/reconnect')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.admin')
  @ApiOperation({ summary: 'Re-run the OAuth authorize step for an existing connection' })
  @ApiCreatedResponse({ type: InitiateOAuthSuccessResponseDto })
  reconnect(@Param('id') id: string, @Body() dto: ReconnectDto) {
    return this.integrationConnectionService.reconnect(id, dto.redirectUri);
  }

  @Post(':id/refresh-token')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.admin')
  @ApiOperation({ summary: 'Force-refresh the OAuth access token for a connection' })
  @ApiCreatedResponse({ type: IntegrationConnectionSuccessResponseDto })
  async refreshToken(@Param('id') id: string): Promise<IntegrationConnectionResponseDto> {
    const connection = await this.integrationConnectionService.refreshToken(id);
    return IntegrationConnectionResponseDto.fromEntity(connection);
  }

  @Post(':id/health-check')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.admin')
  @ApiOperation({ summary: 'Run a health check against the provider' })
  @ApiCreatedResponse({ type: IntegrationHealthSuccessResponseDto })
  checkHealth(@Param('id') id: string) {
    return this.integrationConnectionService.checkHealth(id);
  }

  @Post(':id/sync')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.admin')
  @ApiOperation({ summary: 'Trigger a manual poll/sync for a connection' })
  @ApiCreatedResponse({ type: IntegrationSyncResultSuccessResponseDto })
  sync(@Param('id') id: string) {
    return this.integrationConnectionService.sync(id);
  }

  @Post(':id/webhooks')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.admin')
  @ApiOperation({ summary: 'Register an inbound webhook endpoint for a connection' })
  @ApiCreatedResponse({ type: RegisterWebhookSuccessResponseDto })
  registerWebhook(@Param('id') id: string, @Body() dto: RegisterWebhookDto) {
    return this.integrationConnectionService.registerWebhook(id, dto.secret);
  }

  @Get(':id/events')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.read')
  @ApiOperation({ summary: 'List events observed for a connection' })
  @ApiOkResponse({ type: PaginatedIntegrationEventsResponseDto })
  async listEvents(@Param('id') id: string, @Query() query: ListPageQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.integrationConnectionService.listEvents(id, page, limit);
    return {
      items: items.map((item) => IntegrationEventResponseDto.fromEntity(item)),
      total,
      page,
      limit,
    };
  }

  @Get(':id/sync-runs')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.read')
  @ApiOperation({ summary: 'List sync run history for a connection' })
  @ApiOkResponse({ type: PaginatedIntegrationSyncRunsResponseDto })
  async listSyncRuns(@Param('id') id: string, @Query() query: ListPageQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.integrationConnectionService.listSyncRuns(id, page, limit);
    return {
      items: items.map((item) => IntegrationSyncRunResponseDto.fromEntity(item)),
      total,
      page,
      limit,
    };
  }

  @Get(':id/logs')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.read')
  @ApiOperation({
    summary: 'List API call logs for a connection (status, duration, retries, rate limits)',
  })
  @ApiOkResponse({ type: PaginatedIntegrationApiUsageLogsResponseDto })
  async listLogs(@Param('id') id: string, @Query() query: ListPageQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.integrationConnectionService.listApiUsageLogs(
      id,
      page,
      limit,
    );
    return {
      items: items.map((item): IntegrationApiUsageLogResponseDto => ({
        id: item.id,
        action: item.action,
        statusCode: item.statusCode,
        durationMs: item.durationMs,
        rateLimitRemaining: item.rateLimitRemaining,
        retryCount: item.retryCount,
        error: item.error,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  @Get(':id/metrics')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('integration.read')
  @ApiOperation({
    summary: 'Connection metrics: API usage, retries, rate limits, sync/health history',
  })
  @ApiOkResponse({ type: IntegrationMetricsSuccessResponseDto })
  async getMetrics(@Param('id') id: string): Promise<IntegrationMetricsDto> {
    const metrics = await this.integrationStatsService.getMetrics(id);
    return IntegrationMetricsDto.fromMetrics(metrics);
  }
}
