import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  createRoutedFetchMock,
  jsonFetchResponse,
  signWhatsAppPayload,
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

const WHATSAPP_APP_SECRET = 'test-whatsapp-app-secret';
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
const PHONE_NUMBER_ID = '1234567890';
const CUSTOMER_WA_ID = '15550001111';

describe('Communications — WhatsApp Business (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.WHATSAPP_APP_SECRET = WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
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

  async function connectWhatsApp(accessToken: string): Promise<ConnectionBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/api-key')
      .set(bearerAuthHeaders(accessToken))
      .send({
        channel: 'WHATSAPP',
        displayName: 'Support WhatsApp',
        apiKey: 'whatsapp-permanent-access-token',
        externalAccountId: PHONE_NUMBER_ID,
        extra: { phoneNumberId: PHONE_NUMBER_ID, businessAccountId: 'baid-1' },
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<ConnectionBody>).data;
  }

  function inboundMessagePayload(params: {
    messageId: string;
    timestampSeconds: number;
    text: string;
  }): string {
    return JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: PHONE_NUMBER_ID },
                contacts: [{ profile: { name: 'Jamie Customer' }, wa_id: CUSTOMER_WA_ID }],
                messages: [
                  {
                    from: CUSTOMER_WA_ID,
                    id: params.messageId,
                    timestamp: String(params.timestampSeconds),
                    type: 'text',
                    text: { body: params.text },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  }

  function statusPayload(params: {
    messageId: string;
    status: string;
    timestampSeconds: number;
  }): string {
    return JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: PHONE_NUMBER_ID },
                statuses: [
                  {
                    id: params.messageId,
                    status: params.status,
                    timestamp: String(params.timestampSeconds),
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  }

  function postWebhook(body: string, secret = WHATSAPP_APP_SECRET) {
    return request(app.getHttpServer())
      .post('/api/v1/communications/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signWhatsAppPayload(body, secret))
      .send(body);
  }

  it('answers Meta’s webhook verification handshake only when the token matches', async () => {
    const ok = await request(app.getHttpServer())
      .get('/api/v1/communications/webhooks/whatsapp')
      .query({
        'hub.mode': 'subscribe',
        'hub.verify_token': WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        'hub.challenge': 'challenge-xyz',
      })
      .expect(200);
    expect(ok.text).toBe('challenge-xyz');

    await request(app.getHttpServer())
      .get('/api/v1/communications/webhooks/whatsapp')
      .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong-token', 'hub.challenge': 'x' })
      .expect(403);
  });

  it('connects via API key, storing the phone number id as the external account id', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const connection = await connectWhatsApp(accessToken);
    expect(connection.status).toBe('CONNECTED');
    expect(connection.channel).toBe('WHATSAPP');
    expect(connection.externalAccountId).toBe(PHONE_NUMBER_ID);
  });

  it('rejects an inbound webhook with an invalid signature', async () => {
    const body = inboundMessagePayload({
      messageId: 'wamid.BAD',
      timestampSeconds: 1700000000,
      text: 'hi',
    });
    await postWebhook(body, 'wrong-secret').expect(401);
  });

  it('ingests an incoming text message into a new conversation', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    await connectWhatsApp(accessToken);

    const body = inboundMessagePayload({
      messageId: 'wamid.INBOUND1',
      timestampSeconds: 1700000000,
      text: 'Hi, is my order ready?',
    });
    await postWebhook(body).expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/communications/conversations')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const conversations = (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>)
      .data.items;
    expect(conversations).toHaveLength(1);

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/communications/conversations/${conversations[0].id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const messages = (messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>).data
      .items;
    expect(messages).toHaveLength(1);
    expect(messages[0].direction).toBe('INBOUND');
    expect(messages[0].body).toBe('Hi, is my order ready?');
  });

  it('sends an outgoing reply to the correct customer WhatsApp number', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    await connectWhatsApp(accessToken);
    await postWebhook(
      inboundMessagePayload({
        messageId: 'wamid.INBOUND2',
        timestampSeconds: 1700000010,
        text: 'Any updates?',
      }),
    ).expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/communications/conversations')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const [conversation] = (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>)
      .data.items;

    const { fetchMock, on } = createRoutedFetchMock();
    on(`/${PHONE_NUMBER_ID}/messages`, (_url, init) => {
      const payload = JSON.parse(init?.body as string) as { to: string; text: { body: string } };
      expect(payload.to).toBe(CUSTOMER_WA_ID);
      return jsonFetchResponse(200, { messages: [{ id: 'wamid.OUTBOUND1' }] });
    });
    global.fetch = fetchMock;

    const sendResponse = await request(app.getHttpServer())
      .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .send({ body: 'Yes! Ready for pickup after 2pm.' })
      .expect(201);
    const sent = (sendResponse.body as ApiSuccessResponse<MessageBody>).data;
    expect(sent.direction).toBe('OUTBOUND');
    expect(sent.status).toBe('SENT');
  });

  it('applies a delivered receipt and a read receipt to a previously sent message', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    await connectWhatsApp(accessToken);
    await postWebhook(
      inboundMessagePayload({
        messageId: 'wamid.INBOUND3',
        timestampSeconds: 1700000020,
        text: 'Hello',
      }),
    ).expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/communications/conversations')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const [conversation] = (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>)
      .data.items;

    const { fetchMock, on } = createRoutedFetchMock();
    on(`/${PHONE_NUMBER_ID}/messages`, () =>
      jsonFetchResponse(200, { messages: [{ id: 'wamid.OUTBOUND2' }] }),
    );
    global.fetch = fetchMock;
    await request(app.getHttpServer())
      .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .send({ body: 'On our way!' })
      .expect(201);

    await postWebhook(
      statusPayload({
        messageId: 'wamid.OUTBOUND2',
        status: 'delivered',
        timestampSeconds: 1700000030,
      }),
    ).expect(200);

    let messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/communications/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    let sentMessage = (
      messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>
    ).data.items.find((message) => message.direction === 'OUTBOUND');
    expect(sentMessage?.status).toBe('DELIVERED');

    await postWebhook(
      statusPayload({ messageId: 'wamid.OUTBOUND2', status: 'read', timestampSeconds: 1700000040 }),
    ).expect(200);

    messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/communications/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    sentMessage = (
      messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>
    ).data.items.find((message) => message.direction === 'OUTBOUND');
    expect(sentMessage?.status).toBe('READ');

    const eventClient = prisma.system as unknown as {
      communicationEvent: {
        findMany(args: { where: Record<string, unknown> }): Promise<Array<{ type: string }>>;
      };
    };
    const events = await eventClient.communicationEvent.findMany({
      where: { conversationId: conversation.id },
    });
    expect(events.map((event) => event.type).sort()).toEqual(['DELIVERED', 'READ']);
  });

  it('never leaks a WhatsApp conversation to another organization', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'wa-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'wa-org-b@example.com',
    });
    await connectWhatsApp(orgA.accessToken);
    await postWebhook(
      inboundMessagePayload({
        messageId: 'wamid.ISOLATION1',
        timestampSeconds: 1700000050,
        text: 'Org A only',
      }),
    ).expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/communications/conversations')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    expect(
      (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>).data.items,
    ).toHaveLength(0);
  });
});
