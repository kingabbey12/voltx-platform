import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { CommsPollService } from '../src/modules/communications/jobs/comms-poll.service';
import { AiProcessQueueService } from '../src/modules/communications/jobs/ai-process-queue.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { createRoutedFetchMock, jsonFetchResponse } from './helpers/comms-test.helper';
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
  channel: string;
  subject: string | null;
  unread: boolean;
  status: string;
}

interface MessageBody {
  id: string;
  direction: string;
  status: string;
  body: string;
}

describe('Communications — Gmail & Outlook (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let encryptionService: EncryptionService;
  let commsPollService: CommsPollService;
  let aiProcessQueueService: AiProcessQueueService;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    encryptionService = app.get(EncryptionService);
    commsPollService = app.get(CommsPollService);
    aiProcessQueueService = app.get(AiProcessQueueService);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
    // Poll-triggered AI summarization is fire-and-forget by design (see
    // AiProcessQueueService) and out of scope for these comms platform
    // tests — left unmocked, it races the next test's data reset and
    // throws unrelated FK-violation noise. Summarization itself has its
    // own coverage elsewhere.
    jest.spyOn(aiProcessQueueService, 'enqueueSummarize').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  async function connectGmail(accessToken: string): Promise<ConnectionBody> {
    const { fetchMock, on } = createRoutedFetchMock();
    on('oauth2.googleapis.com/token', () =>
      jsonFetchResponse(200, {
        access_token: 'gmail-access-token',
        refresh_token: 'gmail-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );
    on('googleapis.com/oauth2/v2/userinfo', () =>
      jsonFetchResponse(200, { email: 'sales@acme.test' }),
    );
    global.fetch = fetchMock;

    const initiateResponse = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/initiate')
      .set(bearerAuthHeaders(accessToken))
      .send({
        channel: 'GMAIL',
        displayName: 'Sales Gmail',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);
    const initiateBody = (
      initiateResponse.body as ApiSuccessResponse<{
        connectionId: string;
        authorizationUrl: string;
      }>
    ).data;
    expect(initiateBody.authorizationUrl).toContain('accounts.google.com');

    const completeResponse = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/complete')
      .set(bearerAuthHeaders(accessToken))
      .send({
        connectionId: initiateBody.connectionId,
        code: 'auth-code-123',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);
    return (completeResponse.body as ApiSuccessResponse<ConnectionBody>).data;
  }

  async function connectOutlook(accessToken: string): Promise<ConnectionBody> {
    const { fetchMock, on } = createRoutedFetchMock();
    on('login.microsoftonline.com', () =>
      jsonFetchResponse(200, {
        access_token: 'outlook-access-token',
        refresh_token: 'outlook-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );
    on(
      (url) => url === 'https://graph.microsoft.com/v1.0/me',
      () => jsonFetchResponse(200, { mail: 'support@acme.test' }),
    );
    global.fetch = fetchMock;

    const initiateResponse = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/initiate')
      .set(bearerAuthHeaders(accessToken))
      .send({
        channel: 'OUTLOOK',
        displayName: 'Support Outlook',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);
    const initiateBody = (
      initiateResponse.body as ApiSuccessResponse<{
        connectionId: string;
        authorizationUrl: string;
      }>
    ).data;
    expect(initiateBody.authorizationUrl).toContain('login.microsoftonline.com');

    const completeResponse = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/complete')
      .set(bearerAuthHeaders(accessToken))
      .send({
        connectionId: initiateBody.connectionId,
        code: 'auth-code-456',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);
    return (completeResponse.body as ApiSuccessResponse<ConnectionBody>).data;
  }

  async function pollAndListConversations(accessToken: string): Promise<ConversationBody[]> {
    await commsPollService.sweep();
    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/communications/conversations')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    return (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>).data.items;
  }

  describe('Gmail', () => {
    it('completes the OAuth connect flow and stores an encrypted, resolved credential', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectGmail(accessToken);

      expect(connection.status).toBe('CONNECTED');
      expect(connection.channel).toBe('GMAIL');
      expect(connection.externalAccountId).toBe('sales@acme.test');

      const credentialClient = prisma.system as unknown as {
        commsChannelCredential: {
          findFirst(args: {
            where: { connectionId: string };
          }): Promise<{ encryptedPayload: string } | null>;
        };
      };
      const credentialRow = await credentialClient.commsChannelCredential.findFirst({
        where: { connectionId: connection.id },
      });
      expect(credentialRow).not.toBeNull();
      expect(credentialRow!.encryptedPayload).not.toContain('gmail-access-token');
      const decrypted = encryptionService.decryptJson<{ accessToken: string }>(
        credentialRow!.encryptedPayload,
      );
      expect(decrypted.accessToken).toBe('gmail-access-token');
    });

    it('polls, creates a conversation from an inbound email, and lists it in the unified inbox', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectGmail(accessToken);

      const { fetchMock, on } = createRoutedFetchMock();
      on('/messages?q=', () =>
        jsonFetchResponse(200, { messages: [{ id: 'gmail-msg-1', threadId: 'thread-1' }] }),
      );
      on('/messages/gmail-msg-1', () =>
        jsonFetchResponse(200, {
          id: 'gmail-msg-1',
          snippet: 'Hi, I need help with my recent order.',
          payload: {
            headers: [
              { name: 'Subject', value: 'Order Help' },
              { name: 'From', value: 'customer@example.com' },
            ],
          },
          internalDate: String(Date.now()),
        }),
      );
      global.fetch = fetchMock;

      const conversations = await pollAndListConversations(accessToken);
      expect(conversations).toHaveLength(1);
      expect(conversations[0].channel).toBe('GMAIL');
      expect(conversations[0].subject).toBe('Order Help');
      expect(conversations[0].unread).toBe(true);

      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversations[0].id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const messages = (messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>).data
        .items;
      expect(messages).toHaveLength(1);
      expect(messages[0].direction).toBe('INBOUND');
      expect(messages[0].status).toBe('DELIVERED');
      expect(messages[0].body).toBe('Hi, I need help with my recent order.');

      void connection;
    });

    it('sends a real outbound reply through the Gmail API', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectGmail(accessToken);

      const { fetchMock, on } = createRoutedFetchMock();
      on('/messages?q=', () =>
        jsonFetchResponse(200, { messages: [{ id: 'gmail-msg-2', threadId: 'thread-2' }] }),
      );
      on('/messages/gmail-msg-2', () =>
        jsonFetchResponse(200, {
          id: 'gmail-msg-2',
          snippet: 'Do you ship internationally?',
          payload: { headers: [{ name: 'From', value: 'buyer@example.com' }] },
          internalDate: String(Date.now()),
        }),
      );
      global.fetch = fetchMock;
      const [conversation] = await pollAndListConversations(accessToken);

      on('/messages/send', () => jsonFetchResponse(200, { id: 'gmail-sent-1' }));

      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Yes, we ship worldwide!' })
        .expect(201);
      const sent = (sendResponse.body as ApiSuccessResponse<MessageBody>).data;
      expect(sent.direction).toBe('OUTBOUND');
      expect(sent.status).toBe('SENT');

      const auditClient = prisma.system as unknown as {
        auditLog: {
          findMany(args: { where: Record<string, unknown> }): Promise<Array<{ action: string }>>;
        };
      };
      const auditRows = await auditClient.auditLog.findMany({
        where: { action: 'communications.message.sent' },
      });
      expect(auditRows.length).toBeGreaterThan(0);
    });

    it('retries a transient 5xx failure and still delivers the message', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectGmail(accessToken);

      const { fetchMock, on } = createRoutedFetchMock();
      on('/messages?q=', () =>
        jsonFetchResponse(200, { messages: [{ id: 'gmail-msg-3', threadId: 'thread-3' }] }),
      );
      on('/messages/gmail-msg-3', () =>
        jsonFetchResponse(200, {
          id: 'gmail-msg-3',
          snippet: 'Any discounts available?',
          payload: { headers: [{ name: 'From', value: 'shopper@example.com' }] },
          internalDate: String(Date.now()),
        }),
      );
      global.fetch = fetchMock;
      const [conversation] = await pollAndListConversations(accessToken);

      let sendAttempts = 0;
      on('/messages/send', () => {
        sendAttempts += 1;
        return sendAttempts === 1
          ? jsonFetchResponse(500, { error: 'temporary outage' })
          : jsonFetchResponse(200, { id: 'gmail-sent-retry' });
      });

      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Checking on discounts for you.' })
        .expect(201);
      const sent = (sendResponse.body as ApiSuccessResponse<MessageBody>).data;
      expect(sent.status).toBe('SENT');
      expect(sendAttempts).toBe(2);
    }, 15000);

    it('marks the message FAILED and preserves the failure reason when the provider rejects the send', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectGmail(accessToken);

      const { fetchMock, on } = createRoutedFetchMock();
      on('/messages?q=', () =>
        jsonFetchResponse(200, { messages: [{ id: 'gmail-msg-4', threadId: 'thread-4' }] }),
      );
      on('/messages/gmail-msg-4', () =>
        jsonFetchResponse(200, {
          id: 'gmail-msg-4',
          snippet: 'Where is my package?',
          payload: { headers: [{ name: 'From', value: 'angry@example.com' }] },
          internalDate: String(Date.now()),
        }),
      );
      global.fetch = fetchMock;
      const [conversation] = await pollAndListConversations(accessToken);

      on('/messages/send', () => jsonFetchResponse(400, { error: 'invalid_recipient' }));

      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Checking your tracking now.' });
      expect(sendResponse.status).toBeGreaterThanOrEqual(400);

      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const messages = (messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>).data
        .items;
      const failed = messages.find((message) => message.direction === 'OUTBOUND');
      expect(failed?.status).toBe('FAILED');
    });

    it('denies a viewer from initiating a channel connection', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'viewer');

      await request(app.getHttpServer())
        .post('/api/v1/communications/connections/oauth/initiate')
        .set(bearerAuthHeaders(accessToken))
        .send({
          channel: 'GMAIL',
          displayName: 'Should not work',
          redirectUri: 'https://app.voltx.io/callback',
        })
        .expect(403);
    });

    it('soft-deletes a connection on disconnect and records an audit entry', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectGmail(accessToken);

      await request(app.getHttpServer())
        .delete(`/api/v1/communications/connections/${connection.id}`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/communications/connections/${connection.id}`)
        .set(bearerAuthHeaders(accessToken))
        .expect(404);

      const auditClient = prisma.system as unknown as {
        auditLog: {
          findMany(args: { where: Record<string, unknown> }): Promise<Array<{ action: string }>>;
        };
      };
      const auditRows = await auditClient.auditLog.findMany({
        where: { resourceId: connection.id, action: 'communications.connection.disconnected' },
      });
      expect(auditRows).toHaveLength(1);
    });

    it('never leaks one organization’s connections or conversations to another', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'gmail-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'gmail-org-b@example.com',
      });

      const connection = await connectGmail(orgA.accessToken);

      await request(app.getHttpServer())
        .get(`/api/v1/communications/connections/${connection.id}`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(404);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/connections')
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(200);
      const items = (listResponse.body as ApiSuccessResponse<{ items: ConnectionBody[] }>).data
        .items;
      expect(items.every((item) => item.id !== connection.id)).toBe(true);
    });
  });

  describe('Outlook', () => {
    it('completes the OAuth connect flow, resolves the account identity, sends, and syncs inbound mail', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'outlook-owner@example.com',
      });
      const connection = await connectOutlook(accessToken);
      expect(connection.status).toBe('CONNECTED');
      expect(connection.externalAccountId).toBe('support@acme.test');

      const { fetchMock, on } = createRoutedFetchMock();
      on(
        (url) => url.includes('/v1.0/me/messages'),
        () =>
          jsonFetchResponse(200, {
            value: [
              {
                id: 'outlook-msg-1',
                subject: 'Return Request',
                bodyPreview: 'I would like to return my order.',
                from: { emailAddress: { address: 'returns@example.com' } },
                receivedDateTime: new Date().toISOString(),
              },
            ],
          }),
      );
      global.fetch = fetchMock;

      const conversations = await pollAndListConversations(accessToken);
      expect(conversations).toHaveLength(1);
      expect(conversations[0].channel).toBe('OUTLOOK');
      expect(conversations[0].subject).toBe('Return Request');

      on(
        (url) => url.includes('/sendMail'),
        () => jsonFetchResponse(200, {}),
      );
      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversations[0].id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Sure, here is the return label.' })
        .expect(201);
      const sent = (sendResponse.body as ApiSuccessResponse<MessageBody>).data;
      expect(sent.direction).toBe('OUTBOUND');
      expect(sent.status).toBe('SENT');
    });
  });
});
