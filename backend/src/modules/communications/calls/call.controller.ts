import { Body, Controller, Get, Param, Patch, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { CallRepository } from './call.repository';
import { CallService } from './call.service';
import {
  CallResponseDto,
  CallSuccessResponseDto,
  ListCallsQueryDto,
  PaginatedCallsSuccessResponseDto,
  UpdateCallNotesDto,
} from './dto/call.dto';

@ApiTags('Communications')
@ApiBearerAuth('JWT')
@Controller('communications/calls')
export class CallController {
  constructor(
    private readonly callService: CallService,
    private readonly callRepository: CallRepository,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
  ) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.read')
  @ApiOperation({ summary: 'List call history (Twilio Voice)' })
  @ApiOkResponse({ type: PaginatedCallsSuccessResponseDto })
  async list(@Query() query: ListCallsQueryDto) {
    const result = await this.callService.listCalls({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    const items = await Promise.all(
      result.items.map(async (call) => {
        const recording = await this.callRepository.findRecordingByCallId(call.id);
        return CallResponseDto.fromEntity(call, Boolean(recording));
      }),
    );
    return { ...result, items };
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.read')
  @ApiOperation({ summary: 'Get a call' })
  @ApiOkResponse({ type: CallSuccessResponseDto })
  async getById(@Param('id') id: string): Promise<CallResponseDto> {
    const call = await this.callService.getCallOrThrow(id);
    const recording = await this.callRepository.findRecordingByCallId(id);
    return CallResponseDto.fromEntity(call, Boolean(recording));
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.update')
  @ApiOperation({ summary: 'Add notes to a call' })
  @ApiOkResponse({ type: CallSuccessResponseDto })
  async updateNotes(
    @Param('id') id: string,
    @Body() dto: UpdateCallNotesDto,
  ): Promise<CallResponseDto> {
    const call = await this.callService.updateNotes(id, dto.notes);
    const recording = await this.callRepository.findRecordingByCallId(id);
    return CallResponseDto.fromEntity(call, Boolean(recording));
  }

  @Get(':id/recording')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('communications.conversation.read')
  @ApiOperation({
    summary:
      "Stream the call recording — proxies Twilio's recording URL through our own auth rather than exposing a Twilio-authenticated URL to the browser",
  })
  async downloadRecording(
    @Param('id') id: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    const call = await this.callService.getCallOrThrow(id);
    const recording = await this.callService.getRecording(id);
    if (!recording) {
      res.status(404).send({ error: 'no_recording' });
      return;
    }

    const connection = await this.channelConnectionRepository.findByIdUnscoped(call.connectionId);
    if (!connection) {
      res.status(404).send({ error: 'connection_not_found' });
      return;
    }
    const credential = await this.channelConnectionService.getValidCredential(connection);
    const accountSid = (credential.extra as { accountSid?: string } | undefined)?.accountSid ?? '';
    const authToken = credential.apiKey ?? '';

    const upstream = await fetch(recording.storageUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      },
    });
    if (!upstream.ok || !upstream.body) {
      res.status(502).send({ error: 'recording_fetch_failed' });
      return;
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  }
}
