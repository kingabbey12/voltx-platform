import { Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { CallRepository } from '../calls/call.repository';
import { CommsCallStatus } from '../calls/entities/call.entity';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

const TWIML_VOICEMAIL_GREETING =
  '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thanks for calling. Please leave a message after the tone.</Say><Record maxLength="120" playBeep="true" recordingStatusCallback="__RECORDING_CALLBACK__" transcribe="true" transcribeCallback="__TRANSCRIBE_CALLBACK__"/></Response>';

const TWILIO_STATUS_TO_CALL_STATUS: Record<string, CommsCallStatus> = {
  ringing: 'RINGING',
  'in-progress': 'IN_PROGRESS',
  completed: 'COMPLETED',
  busy: 'MISSED',
  'no-answer': 'MISSED',
  canceled: 'MISSED',
  failed: 'FAILED',
};

/**
 * Three separate Twilio Voice webhook endpoints, all form-encoded like
 * the SMS webhook: the inbound-call TwiML instructions endpoint, the
 * call-status-change callback, and the recording/transcription
 * callbacks. Kept as one controller (rather than four) since they share
 * every dependency and the connection-resolution/signature-verification
 * logic — only the payload shape and what gets written differs.
 */
@ApiTags('Communications')
@Controller('communications/webhooks/twilio/voice')
export class TwilioVoiceWebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly callRepository: CallRepository,
  ) {}

  @Post('incoming')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'TwiML instructions for an inbound call — answers with a voicemail greeting',
  })
  async incoming(
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const params = new URLSearchParams(rawBody);
    const to = params.get('To');
    const from = params.get('From');
    const callSid = params.get('CallSid');

    if (!(await this.verified(headers, rawBody, to, 'incoming')) || !to || !from || !callSid) {
      response.status(HttpStatus.UNAUTHORIZED).send();
      return;
    }

    const connection =
      await this.channelConnectionRepository.findByChannelAndExternalAccountIdUnscoped(
        'TWILIO_VOICE',
        to,
      );
    if (connection) {
      await this.callRepository.createUnscoped(connection.organizationId, {
        connectionId: connection.id,
        direction: 'INBOUND',
        status: 'RINGING',
        fromNumber: from,
        toNumber: to,
        externalCallId: callSid,
        startedAt: new Date(),
      });
    }

    const webhookBaseUrl = this.configService.get<string>('integrations.webhookBaseUrl', '');
    const twiml = TWIML_VOICEMAIL_GREETING.replace(
      '__RECORDING_CALLBACK__',
      `${webhookBaseUrl}/api/v1/communications/webhooks/twilio/voice/recording`,
    ).replace(
      '__TRANSCRIBE_CALLBACK__',
      `${webhookBaseUrl}/api/v1/communications/webhooks/twilio/voice/transcription`,
    );
    response.status(HttpStatus.OK).type('text/xml').send(twiml);
  }

  @Post('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Call status change callback (ringing/in-progress/completed/etc)' })
  async status(
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const params = new URLSearchParams(rawBody);
    const callSid = params.get('CallSid');
    const to = params.get('To');

    if (!(await this.verified(headers, rawBody, to, 'status')) || !callSid) {
      response.status(HttpStatus.UNAUTHORIZED).send();
      return;
    }

    const call = await this.callRepository.findByExternalCallIdUnscoped(callSid);
    if (call) {
      const twilioStatus = params.get('CallStatus') ?? '';
      const durationSeconds = params.get('CallDuration');
      await this.callRepository.updateUnscoped(call.id, {
        status: TWILIO_STATUS_TO_CALL_STATUS[twilioStatus] ?? call.status,
        ...(durationSeconds ? { durationSeconds: Number(durationSeconds) } : {}),
        ...(twilioStatus === 'completed' ? { endedAt: new Date() } : {}),
      });
    }

    response.status(HttpStatus.OK).send();
  }

  @Post('recording')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recording-ready callback' })
  async recording(
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const params = new URLSearchParams(rawBody);
    const callSid = params.get('CallSid');
    const recordingUrl = params.get('RecordingUrl');

    if (
      !(await this.verified(headers, rawBody, params.get('To'), 'recording')) ||
      !callSid ||
      !recordingUrl
    ) {
      response.status(HttpStatus.UNAUTHORIZED).send();
      return;
    }

    const call = await this.callRepository.findByExternalCallIdUnscoped(callSid);
    if (call) {
      const durationSeconds = params.get('RecordingDuration');
      // Kept as Twilio's own hosted URL rather than re-downloaded into
      // our storage — recordings are large, infrequently played back,
      // and Twilio already retains them; CallController proxies playback
      // requests through with our stored credentials rather than
      // exposing this URL (which requires Twilio Basic Auth) directly.
      await this.callRepository.createRecordingUnscoped(
        call.organizationId,
        call.id,
        `${recordingUrl}.mp3`,
        durationSeconds ? Number(durationSeconds) : undefined,
      );
    }

    response.status(HttpStatus.OK).send();
  }

  @Post('transcription')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recording transcription-ready callback' })
  async transcription(
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const params = new URLSearchParams(rawBody);
    const callSid = params.get('CallSid');
    const text = params.get('TranscriptionText');

    if (
      !(await this.verified(headers, rawBody, params.get('To'), 'transcription')) ||
      !callSid ||
      !text
    ) {
      response.status(HttpStatus.OK).send();
      return;
    }

    const call = await this.callRepository.findByExternalCallIdUnscoped(callSid);
    if (call) {
      await this.callRepository.createTranscriptionUnscoped(call.organizationId, call.id, text);
    }

    response.status(HttpStatus.OK).send();
  }

  private async verified(
    headers: Record<string, string>,
    rawBody: string,
    to: string | null,
    path: string,
  ): Promise<boolean> {
    if (!to) return false;
    const connection =
      await this.channelConnectionRepository.findByChannelAndExternalAccountIdUnscoped(
        'TWILIO_VOICE',
        to,
      );
    if (!connection) return false;

    const provider = this.channelProviderRegistry.get('TWILIO_VOICE');
    const credential = await this.channelConnectionService.getValidCredential(connection);
    const webhookBaseUrl = this.configService.get<string>('integrations.webhookBaseUrl', '');
    const requestUrl = `${webhookBaseUrl}/api/v1/communications/webhooks/twilio/voice/${path}`;

    return (
      provider.verifyWebhookSignature?.(headers, rawBody, credential.apiKey ?? '', requestUrl) ??
      false
    );
  }
}
