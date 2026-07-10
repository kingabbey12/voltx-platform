import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { ChannelConnectionService } from './channel-connection.service';
import { TeamsSubscriptionService } from '../teams/teams-subscription.service';
import {
  ChannelConnectionResponseDto,
  ChannelConnectionSuccessResponseDto,
  CompleteChannelOAuthDto,
  CreateApiKeyChannelConnectionDto,
  InitiateChannelOAuthDto,
  InitiateChannelOAuthSuccessResponseDto,
  ListChannelConnectionsQueryDto,
  PaginatedChannelConnectionsSuccessResponseDto,
  SubscribeTeamsChannelDto,
} from './dto/channel-connection.dto';

@ApiTags('Communications')
@ApiBearerAuth('JWT')
@Controller('communications/connections')
export class ChannelConnectionController {
  constructor(
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly teamsSubscriptionService: TeamsSubscriptionService,
  ) {}

  @Post('oauth/initiate')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.connection.create')
  @ApiOperation({ summary: 'Start an OAuth2 connection for a communication channel' })
  @ApiCreatedResponse({ type: InitiateChannelOAuthSuccessResponseDto })
  initiateOAuth(@Body() dto: InitiateChannelOAuthDto, @CurrentUser() user: CurrentUserInterface) {
    return this.channelConnectionService.initiateOAuth({
      channel: dto.channel,
      displayName: dto.displayName,
      redirectUri: dto.redirectUri,
      createdBy: user.id,
    });
  }

  @Post('oauth/complete')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.connection.create')
  @ApiOperation({ summary: 'Complete an OAuth2 connection using the authorization code' })
  @ApiCreatedResponse({ type: ChannelConnectionSuccessResponseDto })
  async completeOAuth(@Body() dto: CompleteChannelOAuthDto): Promise<ChannelConnectionResponseDto> {
    const connection = await this.channelConnectionService.completeOAuth(dto);
    return ChannelConnectionResponseDto.fromEntity(connection);
  }

  @Post('api-key')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.connection.create')
  @ApiOperation({
    summary: 'Connect a non-OAuth channel (WhatsApp Business, Twilio SMS/Voice) with credentials',
  })
  @ApiCreatedResponse({ type: ChannelConnectionSuccessResponseDto })
  async createApiKeyConnection(
    @Body() dto: CreateApiKeyChannelConnectionDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<ChannelConnectionResponseDto> {
    const connection = await this.channelConnectionService.createApiKeyConnection({
      channel: dto.channel,
      displayName: dto.displayName,
      credential: { apiKey: dto.apiKey, extra: dto.extra },
      externalAccountId: dto.externalAccountId,
      createdBy: user.id,
    });
    return ChannelConnectionResponseDto.fromEntity(connection);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.connection.read')
  @ApiOperation({ summary: 'List communication channel connections' })
  @ApiOkResponse({ type: PaginatedChannelConnectionsSuccessResponseDto })
  async list(@Query() query: ListChannelConnectionsQueryDto) {
    const result = await this.channelConnectionService.listConnections({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      channel: query.channel as never,
    });
    return {
      ...result,
      items: result.items.map((item) => ChannelConnectionResponseDto.fromEntity(item)),
    };
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.connection.read')
  @ApiOperation({ summary: 'Get a communication channel connection' })
  @ApiOkResponse({ type: ChannelConnectionSuccessResponseDto })
  async getById(@Param('id') id: string): Promise<ChannelConnectionResponseDto> {
    const connection = await this.channelConnectionService.getConnectionOrThrow(id);
    return ChannelConnectionResponseDto.fromEntity(connection);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.connection.delete')
  @ApiOperation({ summary: 'Disconnect a communication channel' })
  @ApiOkResponse()
  async disconnect(@Param('id') id: string): Promise<{ disconnected: boolean }> {
    await this.channelConnectionService.disconnect(id);
    return { disconnected: true };
  }

  @Post(':id/teams/subscribe')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.connection.update')
  @ApiOperation({
    summary:
      'Subscribe a Teams connection to a specific team/channel — required once before any messages from it will appear in the inbox',
  })
  async subscribeTeamsChannel(
    @Param('id') id: string,
    @Body() dto: SubscribeTeamsChannelDto,
  ): Promise<{ subscriptionId: string; expiresAt: string }> {
    const result = await this.teamsSubscriptionService.subscribeToChannel(
      id,
      dto.teamId,
      dto.channelId,
    );
    return { subscriptionId: result.subscriptionId, expiresAt: result.expiresAt };
  }
}
