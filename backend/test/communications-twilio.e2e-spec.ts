import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { WorkflowEventBusService } from '../src/modules/workflows/scheduling/workflow-event-bus.service';
import { createTestApp } from './create-test-app';
import {
  binaryFetchResponse,
  createRoutedFetchMock,
  jsonFetchResponse,
  signTwilioRequest,
} from './helpers/comms-test.helper';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

interface ConnectionBody {
  id: string;
  channel: string;
  status: string;
  externalAccountId: string | null;
}

interface ConversationBody {
  id: string;
}

interface MessageBody {
  id: string;
  direction: string;
  status: string;
  body: string;
}

interface CallBody {
  id: string;
  status: string;
  direction: string;
  durationSeconds: number | null;
  notes: string | null;
  hasRecording: boolean;
}

const WEBHOOK_BASE_URL = 'https://api.test.voltx.io';
const SMS_AUTH_TOKEN = 'test-sms-auth-token';
const VOICE_AUTH_TOKEN = 'test-voice-auth-token';
const SMS_NUMBER = '+15551230000';
const VOICE_NUMBER = '+15559990000';
const CUSTOMER_NUMBER = '+15557778888';

describe('Communications — Twilio SMS & Voice (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let workflowEventBus: WorkflowEventBusService;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.INTEGRATIONS_WEBHOOK_BASE_URL = WEBHOOK_BASE_URL;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    workflowEventBus = app.get(WorkflowEventBusService);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
    jest.spyOn(workflowEventBus, 'emit');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
    delete process.env.INTEGRATIONS_WEBHOOK_BASE_URL;
  });

  async function connectSms(accessToken: string): Promise<ConnectionBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/api-key')
      .set(bearerAuthHeaders(accessToken))
      .send({
        channel: 'TWILIO_SMS',
        displayName: 'Support SMS',
        apiKey: SMS_AUTH_TOKEN,
        externalAccountId: SMS_NUMBER,
        extra: { accountSid: 'AC_SMS_ACCOUNT', phoneNumber: SMS_NUMBER },
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<ConnectionBody>).data;
  }

  async function connectVoice(accessToken: string): Promise<ConnectionBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/api-key')
      .set(bearerAuthHeaders(accessToken))
      .send({
        channel: 'TWILIO_VOICE',
        displayName: 'Support Voice',
        apiKey: VOICE_AUTH_TOKEN,
        externalAccountId: VOICE_NUMBER,
        extra: { accountSid: 'AC_VOICE_ACCOUNT', phoneNumber: VOICE_NUMBER },
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<ConnectionBody>).data;
  }

  function signedFormPost(path: string, form: URLSearchParams, authToken: string) {
    const rawBody = form.toString();
    const signature = signTwilioRequest(`${WEBHOOK_BASE_URL}${path}`, rawBody, authToken);
    return request(app.getHttpServer())
      .post(path)
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('X-Twilio-Signature', signature)
      .send(rawBody);
  }

  describe('SMS', () => {
    it('connects via API key', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectSms(accessToken);
      expect(connection.status).toBe('CONNECTED');
      expect(connection.externalAccountId).toBe(SMS_NUMBER);
    });

    it('rejects an inbound SMS webhook with an invalid signature', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectSms(accessToken);

      const form = new URLSearchParams({
        MessageSid: 'SM_BAD',
        From: CUSTOMER_NUMBER,
        To: SMS_NUMBER,
        Body: 'hi',
      });
      await request(app.getHttpServer())
        .post('/api/v1/communications/webhooks/twilio/sms')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Twilio-Signature', 'invalid-signature')
        .send(form.toString())
        .expect(401);
    });

    it('receives an inbound SMS, creating a conversation, then sends a reply and applies a delivery status', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectSms(accessToken);

      const inboundForm = new URLSearchParams({
        MessageSid: 'SM_INBOUND1',
        From: CUSTOMER_NUMBER,
        To: SMS_NUMBER,
        Body: 'Do you have this in stock?',
      });
      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/sms',
        inboundForm,
        SMS_AUTH_TOKEN,
      ).expect(200);

      expect(workflowEventBus.emit).toHaveBeenCalledWith(
        'SMS_RECEIVED',
        expect.objectContaining({ from: CUSTOMER_NUMBER, body: 'Do you have this in stock?' }),
      );

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/conversations')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const [conversation] = (
        listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>
      ).data.items;
      expect(conversation).toBeDefined();

      const { fetchMock, on } = createRoutedFetchMock();
      on('/Messages.json', (_url, init) => {
        const body = new URLSearchParams(init?.body as string);
        expect(body.get('To')).toBe(CUSTOMER_NUMBER);
        return jsonFetchResponse(200, { sid: 'SM_OUTBOUND1', status: 'queued' });
      });
      global.fetch = fetchMock;

      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Yes, in stock! Want us to hold one?' })
        .expect(201);
      const sent = (sendResponse.body as ApiSuccessResponse<MessageBody>).data;
      expect(sent.status).toBe('SENT');

      const statusForm = new URLSearchParams({
        MessageSid: 'SM_OUTBOUND1',
        MessageStatus: 'delivered',
        To: CUSTOMER_NUMBER,
        From: SMS_NUMBER,
      });
      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/sms',
        statusForm,
        SMS_AUTH_TOKEN,
      ).expect(200);

      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const outbound = (
        messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>
      ).data.items.find((message) => message.direction === 'OUTBOUND');
      expect(outbound?.status).toBe('DELIVERED');
    });
  });

  describe('Voice & Calls', () => {
    it('connects via API key', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectVoice(accessToken);
      expect(connection.status).toBe('CONNECTED');
      expect(connection.externalAccountId).toBe(VOICE_NUMBER);
    });

    it('rejects incoming-call TwiML request with an invalid signature', async () => {
      const form = new URLSearchParams({
        To: VOICE_NUMBER,
        From: CUSTOMER_NUMBER,
        CallSid: 'CA_BAD',
      });
      await request(app.getHttpServer())
        .post('/api/v1/communications/webhooks/twilio/voice/incoming')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('X-Twilio-Signature', 'invalid-signature')
        .send(form.toString())
        .expect(401);
    });

    it('creates a call record on an inbound call, answering with voicemail TwiML', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectVoice(accessToken);

      const form = new URLSearchParams({
        To: VOICE_NUMBER,
        From: CUSTOMER_NUMBER,
        CallSid: 'CA_CALL1',
      });
      const response = await signedFormPost(
        '/api/v1/communications/webhooks/twilio/voice/incoming',
        form,
        VOICE_AUTH_TOKEN,
      ).expect(200);
      expect(response.text).toContain('<Record');

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/calls')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const [call] = (listResponse.body as ApiSuccessResponse<{ items: CallBody[] }>).data.items;
      expect(call.status).toBe('RINGING');
      expect(call.direction).toBe('INBOUND');
    });

    it('logs the full call lifecycle: status transitions, recording, and transcription', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectVoice(accessToken);

      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/voice/incoming',
        new URLSearchParams({ To: VOICE_NUMBER, From: CUSTOMER_NUMBER, CallSid: 'CA_CALL2' }),
        VOICE_AUTH_TOKEN,
      ).expect(200);

      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/voice/status',
        new URLSearchParams({ To: VOICE_NUMBER, CallSid: 'CA_CALL2', CallStatus: 'in-progress' }),
        VOICE_AUTH_TOKEN,
      ).expect(200);

      let listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/calls')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      let call = (listResponse.body as ApiSuccessResponse<{ items: CallBody[] }>).data.items[0];
      expect(call.status).toBe('IN_PROGRESS');

      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/voice/status',
        new URLSearchParams({
          To: VOICE_NUMBER,
          CallSid: 'CA_CALL2',
          CallStatus: 'completed',
          CallDuration: '87',
        }),
        VOICE_AUTH_TOKEN,
      ).expect(200);

      expect(workflowEventBus.emit).toHaveBeenCalledWith(
        'VOICE_COMPLETED',
        expect.objectContaining({ durationSeconds: 87 }),
      );

      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/voice/recording',
        new URLSearchParams({
          To: VOICE_NUMBER,
          CallSid: 'CA_CALL2',
          RecordingUrl: 'https://api.twilio.com/recordings/RE123',
          RecordingDuration: '85',
        }),
        VOICE_AUTH_TOKEN,
      ).expect(200);

      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/voice/transcription',
        new URLSearchParams({
          To: VOICE_NUMBER,
          CallSid: 'CA_CALL2',
          TranscriptionText: 'Customer asked about return policy.',
        }),
        VOICE_AUTH_TOKEN,
      ).expect(200);

      listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/calls')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      call = (listResponse.body as ApiSuccessResponse<{ items: CallBody[] }>).data.items[0];
      expect(call.status).toBe('COMPLETED');
      expect(call.durationSeconds).toBe(87);
      expect(call.hasRecording).toBe(true);

      const transcriptionClient = prisma.system as unknown as {
        commsTranscription: {
          findFirst(args: { where: { callId: string } }): Promise<{ text: string } | null>;
        };
      };
      const transcription = await transcriptionClient.commsTranscription.findFirst({
        where: { callId: call.id },
      });
      expect(transcription?.text).toBe('Customer asked about return policy.');

      const notesResponse = await request(app.getHttpServer())
        .patch(`/api/v1/communications/calls/${call.id}`)
        .set(bearerAuthHeaders(accessToken))
        .send({ notes: 'Followed up with return label via email.' })
        .expect(200);
      expect((notesResponse.body as ApiSuccessResponse<CallBody>).data.notes).toBe(
        'Followed up with return label via email.',
      );

      const auditClient = prisma.system as unknown as {
        auditLog: {
          findMany(args: { where: Record<string, unknown> }): Promise<Array<{ action: string }>>;
        };
      };
      const auditRows = await auditClient.auditLog.findMany({
        where: { resourceId: call.id, action: 'communications.call.notes_updated' },
      });
      expect(auditRows).toHaveLength(1);

      const { fetchMock, on } = createRoutedFetchMock();
      on('recordings/RE123', () => binaryFetchResponse(200, Buffer.from('fake-mp3-bytes')));
      global.fetch = fetchMock;

      const recordingResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/calls/${call.id}/recording`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      expect(recordingResponse.headers['content-type']).toContain('audio/mpeg');
    });

    it('never leaks a call record to another organization', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'voice-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'voice-org-b@example.com',
      });
      await connectVoice(orgA.accessToken);
      await signedFormPost(
        '/api/v1/communications/webhooks/twilio/voice/incoming',
        new URLSearchParams({ To: VOICE_NUMBER, From: CUSTOMER_NUMBER, CallSid: 'CA_ISOLATION' }),
        VOICE_AUTH_TOKEN,
      ).expect(200);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/calls')
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(200);
      expect(
        (listResponse.body as ApiSuccessResponse<{ items: CallBody[] }>).data.items,
      ).toHaveLength(0);
    });
  });
});
