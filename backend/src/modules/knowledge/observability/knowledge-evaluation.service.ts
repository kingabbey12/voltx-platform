import { Injectable } from '@nestjs/common';
import { KnowledgeRetrievalService } from '../retrieval/knowledge-retrieval.service';
import { KnowledgeSearchResult } from '../retrieval/knowledge-retrieval.types';

export interface KnowledgeEvaluationCase {
  query: string;
  expectedChunkIds?: string[];
  expectedDocumentIds?: string[];
  expectedSourceIds?: string[];
  expectedCitationChunkIds?: string[];
  expectedCitationDocumentIds?: string[];
  promptTokens?: number;
  completionTokens?: number;
}

export interface KnowledgeEvaluationResult {
  caseCount: number;
  precisionAt5: number;
  recallAt10: number;
  mrr: number;
  ndcgAt10: number;
  citationAccuracy: number;
  hallucinationRate: number;
  contextPrecision: number;
  averageRetrievalTimeMs: number;
  averagePromptTokens: number;
  averageCompletionTokens: number;
}

@Injectable()
export class KnowledgeEvaluationService {
  constructor(private readonly knowledgeRetrievalService: KnowledgeRetrievalService) {}

  async evaluate(cases: KnowledgeEvaluationCase[]): Promise<KnowledgeEvaluationResult> {
    if (cases.length === 0) {
      return {
        caseCount: 0,
        precisionAt5: 0,
        recallAt10: 0,
        mrr: 0,
        ndcgAt10: 0,
        citationAccuracy: 0,
        hallucinationRate: 0,
        contextPrecision: 0,
        averageRetrievalTimeMs: 0,
        averagePromptTokens: 0,
        averageCompletionTokens: 0,
      };
    }

    let precisionAt5Sum = 0;
    let recallAt10Sum = 0;
    let mrrSum = 0;
    let ndcgAt10Sum = 0;
    let citationAccuracySum = 0;
    let contextPrecisionSum = 0;
    let retrievalTimeSum = 0;
    let promptTokensSum = 0;
    let completionTokensSum = 0;

    for (const item of cases) {
      const startedAt = Date.now();
      const results = await this.knowledgeRetrievalService.search(item.query, {
        topK: 10,
        minConfidence: 0,
      });
      retrievalTimeSum += Date.now() - startedAt;

      promptTokensSum += item.promptTokens ?? 0;
      completionTokensSum += item.completionTokens ?? 0;

      const expectedRelevant = this.buildRelevantSet(item);
      const expectedCitations = this.buildCitationSet(item);

      const top10 = results.slice(0, 10);
      const top5 = results.slice(0, 5);

      const top10Relevant = top10.filter((result) => this.isRelevant(result, expectedRelevant));
      const top5Relevant = top5.filter((result) => this.isRelevant(result, expectedRelevant));

      precisionAt5Sum += top5Relevant.length / 5;
      recallAt10Sum +=
        expectedRelevant.size === 0 ? 0 : top10Relevant.length / expectedRelevant.size;
      contextPrecisionSum += top10.length === 0 ? 0 : top10Relevant.length / top10.length;

      const firstRelevantIndex = top10.findIndex((result) =>
        this.isRelevant(result, expectedRelevant),
      );
      mrrSum += firstRelevantIndex === -1 ? 0 : 1 / (firstRelevantIndex + 1);

      ndcgAt10Sum += this.computeNdcgAt10(top10, expectedRelevant);

      const correctCitationCount = top10.filter((result) =>
        this.isCitationCorrect(result, expectedCitations, expectedRelevant),
      ).length;
      citationAccuracySum += top10.length === 0 ? 0 : correctCitationCount / top10.length;
    }

    const caseCount = cases.length;
    const citationAccuracy = citationAccuracySum / caseCount;

    return {
      caseCount,
      precisionAt5: precisionAt5Sum / caseCount,
      recallAt10: recallAt10Sum / caseCount,
      mrr: mrrSum / caseCount,
      ndcgAt10: ndcgAt10Sum / caseCount,
      citationAccuracy,
      hallucinationRate: 1 - citationAccuracy,
      contextPrecision: contextPrecisionSum / caseCount,
      averageRetrievalTimeMs: retrievalTimeSum / caseCount,
      averagePromptTokens: promptTokensSum / caseCount,
      averageCompletionTokens: completionTokensSum / caseCount,
    };
  }

  private buildRelevantSet(item: KnowledgeEvaluationCase): Set<string> {
    const relevant = new Set<string>();
    for (const id of item.expectedChunkIds ?? []) {
      relevant.add(`chunk:${id}`);
    }
    for (const id of item.expectedDocumentIds ?? []) {
      relevant.add(`document:${id}`);
    }
    for (const id of item.expectedSourceIds ?? []) {
      relevant.add(`source:${id}`);
    }
    return relevant;
  }

  private buildCitationSet(item: KnowledgeEvaluationCase): Set<string> {
    const citations = new Set<string>();
    for (const id of item.expectedCitationChunkIds ?? []) {
      citations.add(`chunk:${id}`);
    }
    for (const id of item.expectedCitationDocumentIds ?? []) {
      citations.add(`document:${id}`);
    }
    return citations;
  }

  private isRelevant(result: KnowledgeSearchResult, relevant: Set<string>): boolean {
    if (relevant.size === 0) {
      return false;
    }
    return (
      relevant.has(`chunk:${result.chunkId}`) ||
      relevant.has(`document:${result.citation.documentId}`) ||
      relevant.has(`source:${result.citation.sourceId}`)
    );
  }

  private isCitationCorrect(
    result: KnowledgeSearchResult,
    expectedCitations: Set<string>,
    expectedRelevant: Set<string>,
  ): boolean {
    if (expectedCitations.size > 0) {
      return (
        expectedCitations.has(`chunk:${result.citation.chunkId}`) ||
        expectedCitations.has(`document:${result.citation.documentId}`)
      );
    }
    return this.isRelevant(result, expectedRelevant);
  }

  private computeNdcgAt10(results: KnowledgeSearchResult[], relevant: Set<string>): number {
    if (relevant.size === 0) {
      return 0;
    }

    let dcg = 0;
    for (let i = 0; i < results.length; i += 1) {
      const rel = this.isRelevant(results[i], relevant) ? 1 : 0;
      if (rel === 0) {
        continue;
      }
      dcg += rel / Math.log2(i + 2);
    }

    const idealHits = Math.min(relevant.size, 10);
    let idcg = 0;
    for (let i = 0; i < idealHits; i += 1) {
      idcg += 1 / Math.log2(i + 2);
    }

    return idcg === 0 ? 0 : dcg / idcg;
  }
}
