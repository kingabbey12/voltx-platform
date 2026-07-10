import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { CommsPollService } from '../src/modules/communications/jobs/comms-poll.service';
import { AiProcessQueueService } from '../src/modules/communications/jobs/ai-process-queue.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  binaryFetchResponse,
  createRoutedFetchMock,
  jsonFetchResponse,
  signWhatsAppPayload,
} from './helpers/comms-test.helper';
import {
  authenticateContext,
  bearerAuthHeaders,
  loginAs,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

interface ConversationBody {
  id: string;
}

interface MessageBody {
  id: string;
  direction: string;
}

interface NoteBody {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
}

interface AttachmentBody {
  id: string;
  fileName: string;
  status: string;
}

const WHATSAPP_APP_SECRET = 'test-whatsapp-app-secret';
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
const PHONE_NUMBER_ID = '1234567890';
const CUSTOMER_WA_ID = '15550001111';

describe('Communications — Notes & Attachments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let commsPollService: CommsPollService;
  let aiProcessQueueService: AiProcessQueueService;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    commsPollService = app.get(CommsPollService);
    aiProcessQueueService = app.get(AiProcessQueueService);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
    jest.spyOn(aiProcessQueueService, 'enqueueSummarize').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  });

  async function connectGmailWithConversation(accessToken: string): Promise<ConversationBody> {
    const { fetchMock, on } = createRoutedFetchMock();
    on('oauth2.googleapis.com/token', () =>
      jsonFetchResponse(200, {
        access_token: 'gmail-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    );
    on('googleapis.com/oauth2/v2/userinfo', () =>
      jsonFetchResponse(200, { email: 'notes@acme.test' }),
    );
    global.fetch = fetchMock;

    const initiateResponse = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/initiate')
      .set(bearerAuthHeaders(accessToken))
      .send({
        channel: 'GMAIL',
        displayName: 'Notes Gmail',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);
    const initiateBody = (initiateResponse.body as ApiSuccessResponse<{ connectionId: string }>)
      .data;
    await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/complete')
      .set(bearerAuthHeaders(accessToken))
      .send({
        connectionId: initiateBody.connectionId,
        code: 'code-1',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);

    on('/messages?q=', () =>
      jsonFetchResponse(200, { messages: [{ id: 'gmail-msg-notes', threadId: 't1' }] }),
    );
    on('/messages/gmail-msg-notes', () =>
      jsonFetchResponse(200, {
        id: 'gmail-msg-notes',
        snippet: 'Need help with billing',
        payload: { headers: [{ name: 'From', value: 'billing@example.com' }] },
        internalDate: String(Date.now()),
      }),
    );
    await commsPollService.sweep();

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/communications/conversations')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    return (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>).data.items[0];
  }

  describe('Notes', () => {
    it('creates and lists internal notes on a conversation', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const conversation = await connectGmailWithConversation(accessToken);

      const createResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Customer is a VIP — escalate if unresolved in 1 hour.' })
        .expect(201);
      const note = (createResponse.body as ApiSuccessResponse<NoteBody>).data;
      expect(note.body).toBe('Customer is a VIP — escalate if unresolved in 1 hour.');
      expect(note.conversationId).toBe(conversation.id);

      const listResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const notes = (listResponse.body as ApiSuccessResponse<NoteBody[]>).data;
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe(note.id);

      const auditClient = prisma.system as unknown as {
        auditLog: {
          findMany(args: { where: Record<string, unknown> }): Promise<Array<{ action: string }>>;
        };
      };
      const auditRows = await auditClient.auditLog.findMany({
        where: { resourceId: note.id, action: 'communications.note.created' },
      });
      expect(auditRows).toHaveLength(1);
    });

    it('never sends a note through the channel — it stays internal-only', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const conversation = await connectGmailWithConversation(accessToken);

      // No fetch mock route is registered for a send call — if addNote ever
      // called out to the Gmail API, this would throw "no fetch route
      // matched" and fail the test.
      await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Internal-only note.' })
        .expect(201);

      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      // Only the original inbound message — the note added no channel message.
      expect(
        (messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>).data.items,
      ).toHaveLength(1);
    });

    it('denies a viewer from creating a note, but allows a member', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'notes-admin@example.com',
      });
      const conversation = await connectGmailWithConversation(admin.accessToken);

      const viewer = await seedAuthContext(
        prisma,
        usersRepository,
        'viewer',
        { email: 'notes-viewer@example.com' },
        undefined,
        { organizationId: admin.organization.id },
      );
      const viewerTokens = await loginAs(
        app,
        viewer.user.email,
        viewer.password,
        admin.organization.id,
      );
      await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(viewerTokens.accessToken))
        .send({ body: 'Should be denied' })
        .expect(403);

      const member = await seedAuthContext(
        prisma,
        usersRepository,
        'member',
        { email: 'notes-member@example.com' },
        undefined,
        { organizationId: admin.organization.id },
      );
      const memberTokens = await loginAs(
        app,
        member.user.email,
        member.password,
        admin.organization.id,
      );
      await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(memberTokens.accessToken))
        .send({ body: 'Member can add notes' })
        .expect(201);
    });

    it('never leaks notes across organizations', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'notes-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'notes-org-b@example.com',
      });
      const conversation = await connectGmailWithConversation(orgA.accessToken);
      await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .send({ body: 'Org A private note' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/notes`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .send({ body: 'Should not be allowed' })
        .expect(404);
    });
  });

  describe('Attachments', () => {
    it('persists an outbound attachment reference when sent through a channel', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const conversation = await connectGmailWithConversation(accessToken);

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/v1/attachments/upload')
        .set(bearerAuthHeaders(accessToken))
        .attach('file', Buffer.from('Invoice #4471 attached.'), {
          filename: 'invoice.txt',
          contentType: 'text/plain',
        })
        .expect(201);
      const attachment = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;

      const deadline = Date.now() + 15_000;
      let ready = attachment;
      while (Date.now() < deadline && ready.status !== 'READY') {
        const pollResponse = await request(app.getHttpServer())
          .get(`/api/v1/attachments/${attachment.id}`)
          .set(bearerAuthHeaders(accessToken))
          .expect(200);
        ready = (pollResponse.body as ApiSuccessResponse<AttachmentBody>).data;
        if (ready.status !== 'READY') await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(ready.status).toBe('READY');

      const { fetchMock, on } = createRoutedFetchMock();
      on('/messages/send', () => jsonFetchResponse(200, { id: 'gmail-sent-with-attachment' }));
      global.fetch = fetchMock;

      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'Please find the invoice attached.', attachmentIds: [attachment.id] })
        .expect(201);
      const message = (sendResponse.body as ApiSuccessResponse<MessageBody>).data;

      const referencesResponse = await request(app.getHttpServer())
        .get('/api/v1/attachments')
        .query({ referenceType: 'COMMS_MESSAGE', referenceId: message.id })
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const items = (referencesResponse.body as ApiSuccessResponse<{ items: AttachmentBody[] }>)
        .data.items;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe(attachment.id);
    });

    it('downloads an inbound WhatsApp media attachment and links it to its message', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);

      await request(app.getHttpServer())
        .post('/api/v1/communications/connections/api-key')
        .set(bearerAuthHeaders(accessToken))
        .send({
          channel: 'WHATSAPP',
          displayName: 'Media WhatsApp',
          apiKey: 'whatsapp-token',
          externalAccountId: PHONE_NUMBER_ID,
          extra: { phoneNumberId: PHONE_NUMBER_ID },
        })
        .expect(201);

      // Uses a document (text/plain) rather than an image attachment —
      // image mime types trigger real thumbnail generation, which isn't
      // what this test is about and hangs on non-image placeholder bytes.
      const { fetchMock, on } = createRoutedFetchMock();
      on('graph.facebook.com', (url) => {
        if (url.includes('/media-id-1')) {
          return jsonFetchResponse(200, {
            url: 'https://media.example.com/file-1',
            mime_type: 'text/plain',
          });
        }
        throw new Error(`unexpected graph.facebook.com call: ${url}`);
      });
      on('media.example.com/file-1', () =>
        binaryFetchResponse(200, Buffer.from('fake-document-bytes')),
      );
      global.fetch = fetchMock;

      const webhookBody = JSON.stringify({
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: PHONE_NUMBER_ID },
                  contacts: [{ profile: { name: 'Jamie' }, wa_id: CUSTOMER_WA_ID }],
                  messages: [
                    {
                      from: CUSTOMER_WA_ID,
                      id: 'wamid.MEDIA1',
                      timestamp: '1700000000',
                      type: 'document',
                      document: { id: 'media-id-1', mime_type: 'text/plain', filename: 'note.txt' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });
      await request(app.getHttpServer())
        .post('/api/v1/communications/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature-256', signWhatsAppPayload(webhookBody, WHATSAPP_APP_SECRET))
        .send(webhookBody)
        .expect(200);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/conversations')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const [conversation] = (
        listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>
      ).data.items;
      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const [message] = (messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>).data
        .items;

      const referencesResponse = await request(app.getHttpServer())
        .get('/api/v1/attachments')
        .query({ referenceType: 'COMMS_MESSAGE', referenceId: message.id })
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const items = (referencesResponse.body as ApiSuccessResponse<{ items: AttachmentBody[] }>)
        .data.items;
      expect(items).toHaveLength(1);

      const deadline = Date.now() + 15_000;
      let ready = items[0];
      while (Date.now() < deadline && ready.status !== 'READY') {
        const pollResponse = await request(app.getHttpServer())
          .get(`/api/v1/attachments/${items[0].id}`)
          .set(bearerAuthHeaders(accessToken))
          .expect(200);
        ready = (pollResponse.body as ApiSuccessResponse<AttachmentBody>).data;
        if (ready.status !== 'READY') await new Promise((resolve) => setTimeout(resolve, 200));
      }
      expect(ready.status).toBe('READY');

      const downloadResponse = await request(app.getHttpServer())
        .get(`/api/v1/attachments/${items[0].id}/download`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      expect(downloadResponse.text).toBe('fake-document-bytes');
    }, 20000);

    it('never lets another organization download a comms attachment', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'attach-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'attach-org-b@example.com',
      });
      const conversation = await connectGmailWithConversation(orgA.accessToken);

      const uploadResponse = await request(app.getHttpServer())
        .post('/api/v1/attachments/upload')
        .set(bearerAuthHeaders(orgA.accessToken))
        .attach('file', Buffer.from('org A only'), {
          filename: 'private.txt',
          contentType: 'text/plain',
        })
        .expect(201);
      const attachment = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;

      const deadline = Date.now() + 15_000;
      let ready = attachment;
      while (Date.now() < deadline && ready.status !== 'READY') {
        const pollResponse = await request(app.getHttpServer())
          .get(`/api/v1/attachments/${attachment.id}`)
          .set(bearerAuthHeaders(orgA.accessToken))
          .expect(200);
        ready = (pollResponse.body as ApiSuccessResponse<AttachmentBody>).data;
        if (ready.status !== 'READY') await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const { fetchMock, on } = createRoutedFetchMock();
      on('/messages/send', () => jsonFetchResponse(200, { id: 'gmail-sent-isolation' }));
      global.fetch = fetchMock;
      await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .send({ body: 'Confidential doc attached.', attachmentIds: [attachment.id] })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/attachments/${attachment.id}/download`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(404);
    });
  });
});
