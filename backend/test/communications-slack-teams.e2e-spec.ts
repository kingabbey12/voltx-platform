import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  createRoutedFetchMock,
  jsonFetchResponse,
  signSlackPayload,
} from './helpers/comms-test.helper';
import {
  authenticateContext,
  bearerAuthHeaders,
  loginAs,
  resetAndSeedAuthTestData,
  seedAuthContext,
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
  externalThreadId?: string | null;
}

interface MessageBody {
  id: string;
  direction: string;
  status: string;
  body: string;
}

const SLACK_SIGNING_SECRET = 'test-slack-signing-secret';

describe('Communications — Slack & Microsoft Teams (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let encryptionService: EncryptionService;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    process.env.SLACK_SIGNING_SECRET = SLACK_SIGNING_SECRET;
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    encryptionService = app.get(EncryptionService);
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
    delete process.env.SLACK_SIGNING_SECRET;
  });

  async function connectSlack(accessToken: string): Promise<ConnectionBody> {
    const { fetchMock, on } = createRoutedFetchMock();
    on('slack.com/api/oauth.v2.access', () =>
      jsonFetchResponse(200, {
        access_token: 'slack-access-token',
        token_type: 'Bearer',
      }),
    );
    on('slack.com/api/auth.test', () =>
      jsonFetchResponse(200, { ok: true, team_id: 'T100', team: 'Acme Workspace' }),
    );
    global.fetch = fetchMock;

    const initiateResponse = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/initiate')
      .set(bearerAuthHeaders(accessToken))
      .send({
        channel: 'SLACK',
        displayName: 'Acme Slack',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);
    const initiateBody = (
      initiateResponse.body as ApiSuccessResponse<{
        connectionId: string;
        authorizationUrl: string;
      }>
    ).data;
    expect(initiateBody.authorizationUrl).toContain('slack.com');

    const completeResponse = await request(app.getHttpServer())
      .post('/api/v1/communications/connections/oauth/complete')
      .set(bearerAuthHeaders(accessToken))
      .send({
        connectionId: initiateBody.connectionId,
        code: 'slack-code-1',
        redirectUri: 'https://app.voltx.io/callback',
      })
      .expect(201);
    return (completeResponse.body as ApiSuccessResponse<ConnectionBody>).data;
  }

  function slackEventBody(params: {
    teamId: string;
    channel: string;
    user: string;
    text: string;
    ts: string;
  }): string {
    return JSON.stringify({
      type: 'event_callback',
      team_id: params.teamId,
      event: {
        type: 'message',
        channel: params.channel,
        user: params.user,
        text: params.text,
        ts: params.ts,
      },
    });
  }

  // ConversationResponseDto deliberately doesn't expose externalThreadId to
  // API clients (it's a channel-internal correlation id, not user-facing) —
  // read it straight from the row for thread-handling assertions instead.
  async function getExternalThreadId(conversationId: string): Promise<string | null> {
    const client = prisma.system as unknown as {
      commsConversation: {
        findFirst(args: {
          where: { id: string };
        }): Promise<{ externalThreadId: string | null } | null>;
      };
    };
    const row = await client.commsConversation.findFirst({ where: { id: conversationId } });
    return row?.externalThreadId ?? null;
  }

  function postSlackWebhook(body: string, secret = SLACK_SIGNING_SECRET) {
    const { timestamp, signature } = signSlackPayload(body, secret);
    return request(app.getHttpServer())
      .post('/api/v1/communications/webhooks/slack')
      .set('Content-Type', 'application/json')
      .set('X-Slack-Request-Timestamp', timestamp)
      .set('X-Slack-Signature', signature)
      .send(body);
  }

  describe('Slack', () => {
    it('completes the OAuth connect flow and resolves the workspace team id', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectSlack(accessToken);
      expect(connection.status).toBe('CONNECTED');
      expect(connection.externalAccountId).toBe('T100');
    });

    it('answers the Slack Events API url_verification handshake', async () => {
      const body = JSON.stringify({ type: 'url_verification', challenge: 'challenge-token-1' });
      const response = await postSlackWebhook(body).expect(200);
      expect((response.body as { challenge: string }).challenge).toBe('challenge-token-1');
    });

    it('rejects a webhook with an invalid signature', async () => {
      const body = slackEventBody({
        teamId: 'T100',
        channel: 'C1',
        user: 'U1',
        text: 'hi',
        ts: '1.1',
      });
      await postSlackWebhook(body, 'wrong-secret').expect(401);
    });

    it('ingests an inbound event, creating a conversation and message', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectSlack(accessToken);

      const body = slackEventBody({
        teamId: 'T100',
        channel: 'C200',
        user: 'U300',
        text: 'Is anyone available to help?',
        ts: '1700000001.000100',
      });
      await postSlackWebhook(body).expect(200);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/conversations')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const conversations = (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>)
        .data.items;
      expect(conversations).toHaveLength(1);
      expect(conversations[0].channel).toBe('SLACK');
      expect(await getExternalThreadId(conversations[0].id)).toBe('C200');
    });

    it('is idempotent — redelivering the same Slack event only creates one message', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectSlack(accessToken);

      const body = slackEventBody({
        teamId: 'T100',
        channel: 'C201',
        user: 'U301',
        text: 'Duplicate delivery test',
        ts: '1700000002.000200',
      });
      await postSlackWebhook(body).expect(200);
      await postSlackWebhook(body).expect(200);

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
      expect(
        (messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>).data.items,
      ).toHaveLength(1);
    });

    it('keeps every message in the same channel/thread on one conversation', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectSlack(accessToken);

      await postSlackWebhook(
        slackEventBody({
          teamId: 'T100',
          channel: 'C300',
          user: 'U1',
          text: 'First message',
          ts: '1700000010.0001',
        }),
      ).expect(200);
      await postSlackWebhook(
        slackEventBody({
          teamId: 'T100',
          channel: 'C300',
          user: 'U1',
          text: 'Second message',
          ts: '1700000011.0002',
        }),
      ).expect(200);

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
      expect(messages).toHaveLength(2);
    });

    it('sends a reply back into the correct Slack channel/thread', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      await connectSlack(accessToken);

      await postSlackWebhook(
        slackEventBody({
          teamId: 'T100',
          channel: 'C400',
          user: 'U1',
          text: 'Need a hand',
          ts: '1700000020.0001',
        }),
      ).expect(200);
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/conversations')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const [conversation] = (
        listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>
      ).data.items;

      const { fetchMock, on } = createRoutedFetchMock();
      on('chat.postMessage', (_url, init) => {
        const payload = JSON.parse(init?.body as string) as { channel: string };
        expect(payload.channel).toBe('C400');
        return jsonFetchResponse(200, { ok: true, ts: '1700000021.0003', channel: 'C400' });
      });
      global.fetch = fetchMock;

      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'On it!' })
        .expect(201);
      const sent = (sendResponse.body as ApiSuccessResponse<MessageBody>).data;
      expect(sent.status).toBe('SENT');
    });

    it('denies a viewer from sending a message, but allows a manager', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'slack-admin@example.com',
      });
      await connectSlack(admin.accessToken);
      await postSlackWebhook(
        slackEventBody({
          teamId: 'T100',
          channel: 'C500',
          user: 'U1',
          text: 'RBAC test',
          ts: '1700000030.0001',
        }),
      ).expect(200);
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/conversations')
        .set(bearerAuthHeaders(admin.accessToken))
        .expect(200);
      const [conversation] = (
        listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>
      ).data.items;

      const viewer = await seedAuthContext(
        prisma,
        usersRepository,
        'viewer',
        {
          email: 'slack-viewer@example.com',
        },
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
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(viewerTokens.accessToken))
        .send({ body: 'Should be denied' })
        .expect(403);

      const manager = await seedAuthContext(
        prisma,
        usersRepository,
        'manager',
        {
          email: 'slack-manager@example.com',
        },
        undefined,
        { organizationId: admin.organization.id },
      );
      const managerTokens = await loginAs(
        app,
        manager.user.email,
        manager.password,
        admin.organization.id,
      );

      const { fetchMock, on } = createRoutedFetchMock();
      on('chat.postMessage', () =>
        jsonFetchResponse(200, { ok: true, ts: '1700000031.0004', channel: 'C500' }),
      );
      global.fetch = fetchMock;

      await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversation.id}/messages`)
        .set(bearerAuthHeaders(managerTokens.accessToken))
        .send({ body: 'Manager can reply' })
        .expect(201);
    });
  });

  describe('Microsoft Teams', () => {
    async function connectTeams(accessToken: string): Promise<ConnectionBody> {
      const { fetchMock, on } = createRoutedFetchMock();
      on('login.microsoftonline.com', () =>
        jsonFetchResponse(200, {
          access_token: 'teams-access-token',
          refresh_token: 'teams-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      );
      on(
        (url) => url === 'https://graph.microsoft.com/v1.0/me',
        () => jsonFetchResponse(200, { mail: 'ops@acme.test' }),
      );
      global.fetch = fetchMock;

      const initiateResponse = await request(app.getHttpServer())
        .post('/api/v1/communications/connections/oauth/initiate')
        .set(bearerAuthHeaders(accessToken))
        .send({
          channel: 'TEAMS',
          displayName: 'Ops Teams',
          redirectUri: 'https://app.voltx.io/callback',
        })
        .expect(201);
      const initiateBody = (
        initiateResponse.body as ApiSuccessResponse<{
          connectionId: string;
          authorizationUrl: string;
        }>
      ).data;

      const completeResponse = await request(app.getHttpServer())
        .post('/api/v1/communications/connections/oauth/complete')
        .set(bearerAuthHeaders(accessToken))
        .send({
          connectionId: initiateBody.connectionId,
          code: 'teams-code-1',
          redirectUri: 'https://app.voltx.io/callback',
        })
        .expect(201);
      return (completeResponse.body as ApiSuccessResponse<ConnectionBody>).data;
    }

    async function subscribeTeamsChannel(
      accessToken: string,
      connectionId: string,
    ): Promise<{ subscriptionId: string; clientState: string }> {
      const { fetchMock, on } = createRoutedFetchMock();
      on(
        (url) => url.includes('/subscriptions'),
        () =>
          jsonFetchResponse(200, {
            id: 'sub-abc',
            expirationDateTime: new Date(Date.now() + 55 * 60_000).toISOString(),
          }),
      );
      global.fetch = fetchMock;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/communications/connections/${connectionId}/teams/subscribe`)
        .set(bearerAuthHeaders(accessToken))
        .send({ teamId: 'team-1', channelId: 'chan-1' })
        .expect(201);
      const body = (response.body as ApiSuccessResponse<{ subscriptionId: string }>).data;
      expect(body.subscriptionId).toBe('sub-abc');

      const credentialClient = prisma.system as unknown as {
        commsChannelCredential: {
          findFirst(args: {
            where: { connectionId: string };
          }): Promise<{ encryptedPayload: string } | null>;
        };
      };
      const credentialRow = await credentialClient.commsChannelCredential.findFirst({
        where: { connectionId },
      });
      const decrypted = encryptionService.decryptJson<{ extra?: { teamsClientState?: string } }>(
        credentialRow!.encryptedPayload,
      );
      return {
        subscriptionId: body.subscriptionId,
        clientState: decrypted.extra!.teamsClientState!,
      };
    }

    function teamsNotificationBody(params: {
      subscriptionId: string;
      clientState: string;
      teamId: string;
      channelId: string;
      messageId: string;
    }): string {
      return JSON.stringify({
        value: [
          {
            subscriptionId: params.subscriptionId,
            clientState: params.clientState,
            resource: `teams('${params.teamId}')/channels('${params.channelId}')/messages('${params.messageId}')`,
            resourceData: { id: params.messageId },
          },
        ],
      });
    }

    it('completes the OAuth connect flow and resolves the account identity', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectTeams(accessToken);
      expect(connection.status).toBe('CONNECTED');
      expect(connection.externalAccountId).toBe('ops@acme.test');
    });

    it('answers the Graph subscription validation handshake', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/communications/webhooks/teams')
        .query({ validationToken: 'graph-validation-token' })
        .set('Content-Type', 'application/json')
        .send('{}')
        .expect(200);
      expect(response.text).toBe('graph-validation-token');
    });

    it('subscribes a channel, then ingests a change notification into the right conversation', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectTeams(accessToken);
      const { subscriptionId, clientState } = await subscribeTeamsChannel(
        accessToken,
        connection.id,
      );

      const { fetchMock, on } = createRoutedFetchMock();
      on(
        (url) => url.includes('/teams/team-1/channels/chan-1/messages/msg-1'),
        () =>
          jsonFetchResponse(200, {
            id: 'msg-1',
            body: { content: 'Can someone check this ticket?' },
            from: { user: { id: 'teams-user-9', displayName: 'Jordan' } },
            createdDateTime: new Date().toISOString(),
          }),
      );
      global.fetch = fetchMock;

      const body = teamsNotificationBody({
        subscriptionId,
        clientState,
        teamId: 'team-1',
        channelId: 'chan-1',
        messageId: 'msg-1',
      });
      await request(app.getHttpServer())
        .post('/api/v1/communications/webhooks/teams')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(200);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/conversations')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const conversations = (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>)
        .data.items;
      expect(conversations).toHaveLength(1);
      expect(conversations[0].channel).toBe('TEAMS');
      expect(await getExternalThreadId(conversations[0].id)).toBe('team-1/chan-1');

      const messagesResponse = await request(app.getHttpServer())
        .get(`/api/v1/communications/conversations/${conversations[0].id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const messages = (messagesResponse.body as ApiSuccessResponse<{ items: MessageBody[] }>).data
        .items;
      expect(messages[0].body).toBe('Can someone check this ticket?');

      const { fetchMock: replyFetchMock, on: onReply } = createRoutedFetchMock();
      onReply(
        (url) => url.endsWith('/teams/team-1/channels/chan-1/messages'),
        () => jsonFetchResponse(200, { id: 'sent-msg-1' }),
      );
      global.fetch = replyFetchMock;

      const sendResponse = await request(app.getHttpServer())
        .post(`/api/v1/communications/conversations/${conversations[0].id}/messages`)
        .set(bearerAuthHeaders(accessToken))
        .send({ body: 'On it, checking now.' })
        .expect(201);
      expect((sendResponse.body as ApiSuccessResponse<MessageBody>).data.status).toBe('SENT');
    });

    it('rejects a notification whose clientState does not match', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await connectTeams(accessToken);
      const { subscriptionId } = await subscribeTeamsChannel(accessToken, connection.id);

      const body = teamsNotificationBody({
        subscriptionId,
        clientState: 'wrong-client-state',
        teamId: 'team-1',
        channelId: 'chan-1',
        messageId: 'msg-2',
      });
      await request(app.getHttpServer())
        .post('/api/v1/communications/webhooks/teams')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(401);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/communications/conversations')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      expect(
        (listResponse.body as ApiSuccessResponse<{ items: ConversationBody[] }>).data.items,
      ).toHaveLength(0);
    });
  });
});
