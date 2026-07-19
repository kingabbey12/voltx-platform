import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Workbook } from 'exceljs';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { AIEmbeddingRequest, AIEmbeddingResponse } from '../src/modules/ai/models/ai-model.types';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

const EMBEDDING_DIMENSIONS = 1536;

function topicVector(topic: 'sales' | 'support' | 'neutral'): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  if (topic === 'sales') {
    vector[0] = 1;
  } else if (topic === 'support') {
    vector[1] = 1;
  } else {
    vector[2] = 1;
  }
  return vector;
}

function classify(text: string): 'sales' | 'support' | 'neutral' {
  const lower = text.toLowerCase();
  if (lower.includes('pipeline') || lower.includes('acme') || lower.includes('deal')) {
    return 'sales';
  }
  if (lower.includes('ticket') || lower.includes('support') || lower.includes('outage')) {
    return 'support';
  }
  return 'neutral';
}

interface SseFrame {
  event: string;
  data: Record<string, unknown>;
}

function parseSseFrames(raw: string): SseFrame[] {
  return raw
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      let event = 'message';
      const dataLines: string[] = [];
      for (const line of chunk.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
          event = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trimStart());
        }
      }
      return { event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> };
    });
}

describe('Knowledge Graph & RAG Platform (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let aiRuntimeService: AIRuntimeService;
  let modelRegistryService: ModelRegistryService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    aiRuntimeService = app.get(AIRuntimeService);
    modelRegistryService = app.get(ModelRegistryService);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await resetAndSeedAuthTestData(prisma);

    jest.spyOn(modelRegistryService, 'resolveProviderAndModel').mockResolvedValue({
      provider: { name: 'openai' } as never,
      model: {
        id: 'gpt-5-mini',
        provider: 'openai',
        family: 'gpt-5',
        displayName: 'GPT-5 Mini',
        supportsStreaming: true,
        supportsEmbeddings: false,
      } as never,
    });

    jest
      .spyOn(aiRuntimeService, 'embeddings')
      .mockImplementation(
        (input: Pick<AIEmbeddingRequest, 'input'> & { provider?: string; model?: string }) =>
          Promise.resolve({
            provider: 'openai',
            model: 'text-embedding-3-small',
            vectors: input.input.map((text) => topicVector(classify(text))),
          } as AIEmbeddingResponse),
      );
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  async function createSource(accessToken: string, name: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/knowledge/sources')
      .set(bearerAuthHeaders(accessToken))
      .send({ type: 'DOCUMENT', name })
      .expect(201);
    return (response.body as ApiSuccessResponse<{ id: string }>).data;
  }

  async function ingestText(
    accessToken: string,
    sourceId: string,
    params: { title: string; text: string; externalId?: string },
  ) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${sourceId}/documents`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: params.title,
        contentType: 'text',
        text: params.text,
        externalId: params.externalId,
      })
      .expect(201);
    return (
      response.body as ApiSuccessResponse<{
        documentId: string;
        status: string;
        chunkCount: number;
      }>
    ).data;
  }

  it('ingests a document end-to-end: extraction, chunking, embedding, and vector storage', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'CRM Opportunities');

    const result = await ingestText(accessToken, source.id, {
      title: 'Acme Corp Deal',
      text: 'Acme Corp is currently in the pipeline at the negotiation stage. The deal size is $120,000.',
    });

    expect(result.status).toBe('INDEXED');
    expect(result.chunkCount).toBeGreaterThan(0);

    const docResponse = await request(app.getHttpServer())
      .get(`/api/v1/knowledge/documents/${result.documentId}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const document = (docResponse.body as ApiSuccessResponse<{ status: string }>).data;
    expect(document.status).toBe('INDEXED');
  });

  it('ingests a real XLSX file (base64) using the real extractor', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Uploaded Files');

    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Deals');
    sheet.addRow(['Company', 'Stage']);
    sheet.addRow(['Acme Corp', 'Negotiation']);
    const xlsxBase64 = Buffer.from(await workbook.xlsx.writeBuffer()).toString('base64');

    const response = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${source.id}/documents`)
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Uploaded Spreadsheet', contentType: 'xlsx', fileBase64: xlsxBase64 })
      .expect(201);

    const result = (response.body as ApiSuccessResponse<{ status: string; chunkCount: number }>)
      .data;
    expect(result.status).toBe('INDEXED');
    expect(result.chunkCount).toBeGreaterThan(0);

    const searchResponse = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(bearerAuthHeaders(accessToken))
      .send({ query: 'Acme Corp Negotiation' })
      .expect(201);
    const results = (
      searchResponse.body as ApiSuccessResponse<Array<{ citation: { documentTitle: string } }>>
    ).data;
    expect(results.some((r) => r.citation.documentTitle === 'Uploaded Spreadsheet')).toBe(true);
  });

  it('supports html, markdown, and txt ingestion content types', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Multi-format Source');

    await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${source.id}/documents`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'HTML Notes',
        contentType: 'html',
        text: '<h1>Acme Corp</h1><p>Pipeline deal moved to negotiation.</p>',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${source.id}/documents`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Markdown Notes',
        contentType: 'markdown',
        text: '# Roadmap\nAcme rollout starts next week.',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${source.id}/documents`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Text Notes',
        contentType: 'txt',
        text: 'Support handoff for Acme has been scheduled.',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(bearerAuthHeaders(accessToken))
      .send({ query: 'Acme pipeline negotiation' })
      .expect(201);

    const results = (
      response.body as ApiSuccessResponse<Array<{ citation: { documentTitle: string } }>>
    ).data;
    expect(results.some((r) => r.citation.documentTitle === 'HTML Notes')).toBe(true);
    expect(results.some((r) => r.citation.documentTitle === 'Markdown Notes')).toBe(true);
    expect(results.some((r) => r.citation.documentTitle === 'Text Notes')).toBe(true);
  });

  it('ranks semantic search results by topical similarity (hybrid retrieval)', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Mixed Records');

    await ingestText(accessToken, source.id, {
      title: 'Acme Deal Update',
      text: 'The Acme Corp deal is progressing through the pipeline toward close.',
    });
    await ingestText(accessToken, source.id, {
      title: 'Support Ticket 42',
      text: 'A customer opened a support ticket about a service outage.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(bearerAuthHeaders(accessToken))
      .send({ query: 'What is the status of the sales pipeline?' })
      .expect(201);

    const results = (
      response.body as ApiSuccessResponse<Array<{ citation: { documentTitle: string } }>>
    ).data;
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].citation.documentTitle).toBe('Acme Deal Update');
  });

  it('finds a document via keyword search even when its topic vector is neutral', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Notes');

    await ingestText(accessToken, source.id, {
      title: 'Distinctive Note',
      text: 'The quarterly offsite will be held in Lisbon this year.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(bearerAuthHeaders(accessToken))
      .send({ query: 'Lisbon offsite' })
      .expect(201);

    const results = (
      response.body as ApiSuccessResponse<Array<{ citation: { documentTitle: string } }>>
    ).data;
    expect(results.some((r) => r.citation.documentTitle === 'Distinctive Note')).toBe(true);
  });

  it('never returns another organization’s chunks (organization isolation)', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'org-a-owner@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'org-b-owner@example.com',
    });

    const sourceA = await createSource(orgA.accessToken, 'Org A Source');
    await ingestText(orgA.accessToken, sourceA.id, {
      title: 'Org A Secret Deal',
      text: 'Org A has a confidential pipeline deal worth a lot of money.',
    });

    const sourceB = await createSource(orgB.accessToken, 'Org B Source');
    await ingestText(orgB.accessToken, sourceB.id, {
      title: 'Org B Note',
      text: 'Org B pipeline deal notes, completely unrelated to org A.',
    });

    const searchAsOrgB = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(bearerAuthHeaders(orgB.accessToken))
      .send({ query: 'pipeline deal' })
      .expect(201);

    const resultsForOrgB = (
      searchAsOrgB.body as ApiSuccessResponse<Array<{ citation: { documentTitle: string } }>>
    ).data;
    expect(resultsForOrgB.every((r) => r.citation.documentTitle !== 'Org A Secret Deal')).toBe(
      true,
    );
    expect(resultsForOrgB.some((r) => r.citation.documentTitle === 'Org B Note')).toBe(true);
  });

  it('reindexes a source, regenerating chunks for every document under it', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Reindex Source');
    await ingestText(accessToken, source.id, {
      title: 'Reindex Doc',
      text: 'This document will be reindexed after ingestion completes.',
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${source.id}/reindex`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);

    const results = (response.body as ApiSuccessResponse<Array<{ status: string }>>).data;
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('INDEXED');
  });

  it('deletes a document and excludes it from subsequent search results', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Delete Source');
    const ingestResult = await ingestText(accessToken, source.id, {
      title: 'Deal To Delete',
      text: 'A pipeline deal that will shortly be deleted from the index.',
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/knowledge/documents/${ingestResult.documentId}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const searchResponse = await request(app.getHttpServer())
      .post('/api/v1/knowledge/search')
      .set(bearerAuthHeaders(accessToken))
      .send({ query: 'pipeline deal' })
      .expect(201);

    const results = (
      searchResponse.body as ApiSuccessResponse<Array<{ citation: { documentTitle: string } }>>
    ).data;
    expect(results.every((r) => r.citation.documentTitle !== 'Deal To Delete')).toBe(true);
  });

  it('links graph entities and traverses the relationship between them', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    await request(app.getHttpServer())
      .post('/api/v1/knowledge/graph/link')
      .set(bearerAuthHeaders(accessToken))
      .send({
        from: { type: 'PERSON', externalId: 'contact-jane', label: 'Jane Doe' },
        to: { type: 'COMPANY', externalId: 'company-acme', label: 'Acme Corp' },
        relationship: 'WORKS_AT',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/api/v1/knowledge/graph/traverse')
      .query({ type: 'PERSON', externalId: 'contact-jane', hops: 1 })
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const nodes = (
      response.body as ApiSuccessResponse<
        Array<{ label: string; depth: number; viaRelationship: string | null }>
      >
    ).data;
    expect(nodes.some((n) => n.label === 'Jane Doe' && n.depth === 0)).toBe(true);
    expect(
      nodes.some(
        (n) => n.label === 'Acme Corp' && n.depth === 1 && n.viaRelationship === 'WORKS_AT',
      ),
    ).toBe(true);
  });

  it('streams indexing/embedding progress events over SSE during ingestion', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Streaming Source');

    const response = await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${source.id}/documents/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Streamed Doc',
        contentType: 'text',
        text: 'Streaming ingestion event coverage test.',
      })
      .expect(200);

    const frames = parseSseFrames(response.text);
    const eventTypes = frames.map((frame) => frame.event);

    expect(eventTypes).toEqual([
      'indexing_started',
      'text_extracted',
      'chunking_completed',
      'embedding_started',
      'embedding_completed',
      'indexing_completed',
      'done',
    ]);
  });

  it('streams the searching/ranking/context-built/citation-ready lifecycle from the preview endpoint', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Preview Source');
    await ingestText(accessToken, source.id, {
      title: 'Preview Deal',
      text: 'The Acme Corp pipeline deal preview content for context building.',
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/knowledge/preview/stream')
      .set(bearerAuthHeaders(accessToken))
      .send({ query: 'Acme pipeline deal' })
      .expect(200);

    const frames = parseSseFrames(response.text);
    const eventTypes = frames.map((frame) => frame.event);

    expect(eventTypes).toEqual([
      'knowledge_searching',
      'knowledge_ranking',
      'knowledge_context_built',
      'knowledge_loaded',
      'knowledge_citation_ready',
      'done',
    ]);
  });

  it('injects knowledge context automatically into a plain AI chat call (Gateway auto-injection)', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Auto Inject Source');
    await ingestText(accessToken, source.id, {
      title: 'Auto Inject Deal',
      text: 'The Acme Corp pipeline deal is worth two hundred thousand dollars.',
    });

    let capturedWorkspaceContext: string[] | undefined;
    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation((input) => {
      capturedWorkspaceContext = input.workspaceContext;
      return (async function* () {
        await Promise.resolve();
        yield {
          type: 'message_end' as const,
          provider: 'openai' as const,
          model: 'gpt-5-mini',
          outputText: 'Acknowledged.',
        };
      })();
    });

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Auto Inject Test' })
      .expect(201);
    const conversation = (conversationResponse.body as ApiSuccessResponse<{ id: string }>).data;

    await request(app.getHttpServer())
      .post(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .send({ content: 'What is the pipeline deal status?' })
      .expect(201);

    expect(capturedWorkspaceContext?.some((entry) => entry.includes('Acme Corp'))).toBe(true);
  });

  it('injects knowledge context into /ai/chat before streaming (conversation-backed path)', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Chat Inject Source');
    await ingestText(accessToken, source.id, {
      title: 'Chat Inject Deal',
      text: 'Acme Corp pipeline review shows negotiation blockers in legal.',
    });

    let capturedWorkspaceContext: string[] | undefined;
    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation((input) => {
      capturedWorkspaceContext = input.workspaceContext;
      return (async function* () {
        await Promise.resolve();
        yield {
          type: 'message_end' as const,
          provider: 'openai' as const,
          model: 'gpt-5-mini',
          outputText: 'Acknowledged.',
        };
      })();
    });

    await request(app.getHttpServer())
      .post('/api/v1/ai/chat')
      .set(bearerAuthHeaders(accessToken))
      .send({ userPrompt: 'Summarize the latest Acme pipeline blockers.' })
      .expect(200);

    expect(capturedWorkspaceContext?.some((entry) => entry.includes('Acme Corp'))).toBe(true);
  });

  it('paginates a large number of documents under a source', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const source = await createSource(accessToken, 'Large Dataset Source');

    for (let i = 0; i < 25; i += 1) {
      await ingestText(accessToken, source.id, {
        title: `Bulk Document ${i}`,
        text: `Bulk ingestion content number ${i} for pagination coverage.`,
      });
    }

    const firstPage = await request(app.getHttpServer())
      .get('/api/v1/knowledge/documents')
      .query({ sourceId: source.id, page: 1, limit: 10 })
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const firstPageBody = (
      firstPage.body as ApiSuccessResponse<{ items: unknown[]; total: number; totalPages: number }>
    ).data;

    expect(firstPageBody.items).toHaveLength(10);
    expect(firstPageBody.total).toBe(25);
    expect(firstPageBody.totalPages).toBe(3);

    const statsResponse = await request(app.getHttpServer())
      .get('/api/v1/knowledge/stats')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const stats = (
      statsResponse.body as ApiSuccessResponse<{ indexSize: { documentCount: number } }>
    ).data;
    expect(stats.indexSize.documentCount).toBe(25);
  }, 30000);
});
