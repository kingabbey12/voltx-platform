import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export type KnowledgeSourceType =
  | "CRM_CONTACT"
  | "CRM_COMPANY"
  | "CRM_OPPORTUNITY"
  | "CRM_ACTIVITY"
  | "NOTE"
  | "DOCUMENT"
  | "EMAIL"
  | "CALENDAR"
  | "TASK"
  | "MEETING"
  | "UPLOADED_FILE"
  | "AI_MEMORY"
  | "OTHER";

export type KnowledgeSourceStatus = "ACTIVE" | "PAUSED" | "ERROR";

export interface KnowledgeSource {
  id: string;
  type: KnowledgeSourceType;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  status: KnowledgeSourceStatus;
  lastIndexedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeSourceInput {
  type: KnowledgeSourceType;
  name: string;
  description?: string;
  config?: Record<string, unknown>;
}

export interface UpdateKnowledgeSourceInput {
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  status?: KnowledgeSourceStatus;
}

export type KnowledgeDocumentStatus = "PENDING" | "INDEXING" | "INDEXED" | "FAILED";

export interface KnowledgeDocument {
  id: string;
  sourceId: string;
  externalId: string | null;
  title: string;
  contentType: string;
  metadata: Record<string, unknown>;
  status: KnowledgeDocumentStatus;
  indexedAt: string | null;
  error: string | null;
  createdAt: string;
}

export interface IngestKnowledgeDocumentInput {
  externalId?: string;
  title: string;
  contentType: string;
  text?: string;
  fileBase64?: string;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeIngestionResult {
  documentId: string;
  status: "INDEXED" | "FAILED";
  chunkCount: number;
  error?: string;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  content: string;
  confidence: number;
  semanticScore: number | null;
  keywordScore: number | null;
  citation: {
    sourceId: string;
    sourceType: string;
    sourceName: string;
    documentId: string;
    documentTitle: string;
    externalId: string | null;
  };
}

export interface KnowledgeContextPreview {
  contextStrings: string[];
  citations: {
    sourceId: string;
    sourceType: string;
    sourceName: string;
    documentId: string;
    documentTitle: string;
    externalId: string | null;
  }[];
  confidence: number;
}

export interface KnowledgeStats {
  indexSize: {
    sourceCount: number;
    documentCount: number;
    chunkCount: number;
    entityCount: number;
    relationshipCount: number;
  };
  embedding: {
    callCount: number;
    averageLatencyMs: number;
    totalCostUsd: number;
  };
  retrieval: {
    searchCount: number;
    averageLatencyMs: number;
    hitRate: number;
    cacheHitRate: number;
    averageConfidence: number;
  };
}

export interface KnowledgeHealth {
  healthy: boolean;
  reasons: string[];
}

export interface KnowledgeGraphNode {
  id: string;
  type: string;
  name: string;
  externalId: string | null;
  relationshipType: string;
  depth: number;
}

export interface LinkKnowledgeEntitiesInput {
  sourceType: string;
  sourceExternalId: string;
  sourceName: string;
  targetType: string;
  targetExternalId: string;
  targetName: string;
  relationshipType: string;
}

export const knowledgeApi = {
  // ─── Sources ─────────────────────────────────────────────────────────
  createSource: (input: CreateKnowledgeSourceInput) =>
    apiClient.post<KnowledgeSource>("/knowledge/sources", input),

  listSources: (query: {
    page?: number;
    limit?: number;
    type?: KnowledgeSourceType;
    status?: KnowledgeSourceStatus;
  } = {}) =>
    apiClient.get<PaginatedResult<KnowledgeSource>>("/knowledge/sources", {
      query: { page: 1, limit: 20, ...query },
    }),

  getSource: (id: string) => apiClient.get<KnowledgeSource>(`/knowledge/sources/${id}`),

  updateSource: (id: string, input: UpdateKnowledgeSourceInput) =>
    apiClient.patch<KnowledgeSource>(`/knowledge/sources/${id}`, input),

  deleteSource: (id: string) => apiClient.delete<KnowledgeSource>(`/knowledge/sources/${id}`),

  reindexSource: (id: string) =>
    apiClient.post<KnowledgeIngestionResult[]>(`/knowledge/sources/${id}/reindex`),

  // ─── Documents ───────────────────────────────────────────────────────
  ingestDocument: (sourceId: string, input: IngestKnowledgeDocumentInput) =>
    apiClient.post<KnowledgeIngestionResult>(`/knowledge/sources/${sourceId}/documents`, input),

  listDocuments: (query: {
    page?: number;
    limit?: number;
    sourceId?: string;
    status?: KnowledgeDocumentStatus;
  } = {}) =>
    apiClient.get<PaginatedResult<KnowledgeDocument>>("/knowledge/documents", {
      query: { page: 1, limit: 20, ...query },
    }),

  getDocument: (id: string) => apiClient.get<KnowledgeDocument>(`/knowledge/documents/${id}`),

  deleteDocument: (id: string) => apiClient.delete<KnowledgeDocument>(`/knowledge/documents/${id}`),

  refreshDocument: (id: string) =>
    apiClient.post<KnowledgeIngestionResult>(`/knowledge/documents/${id}/refresh`),

  // ─── Stats & Health ──────────────────────────────────────────────────
  getStats: () => apiClient.get<KnowledgeStats>("/knowledge/stats"),

  getHealth: () => apiClient.get<KnowledgeHealth>("/knowledge/health"),

  // ─── Graph ────────────────────────────────────────────────────────────
  linkGraphEntities: (input: LinkKnowledgeEntitiesInput) =>
    apiClient.post<{ linked: true }>("/knowledge/graph/link", input),

  traverseGraph: (query: {
    type: string;
    externalId: string;
    hops?: number;
  }) => apiClient.get<KnowledgeGraphNode[]>("/knowledge/graph/traverse", { query }),

  // ─── Search ──────────────────────────────────────────────────────────
  search: (input: {
    query: string;
    topK?: number;
    minConfidence?: number;
    sourceIds?: string[];
    sourceTypes?: string[];
  }) => apiClient.post<KnowledgeSearchResult[]>("/knowledge/search", input),

  preview: (input: {
    query: string;
    topK?: number;
    minConfidence?: number;
    sourceIds?: string[];
    sourceTypes?: string[];
  }) => apiClient.post<KnowledgeContextPreview>("/knowledge/preview", input),
};
