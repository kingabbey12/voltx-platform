import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';
import 'package:voltx_mobile/features/knowledge/data/models/knowledge_models.dart';
import 'package:voltx_mobile/features/knowledge/data/services/knowledge_api_service.dart';

void main() {
  group('KnowledgePageQuery', () {
    test('toQueryParameters omits type/status when null', () {
      const query = KnowledgePageQuery(page: 1, limit: 20);
      expect(query.toQueryParameters(), {'page': 1, 'limit': 20});
    });

    test('equality and hashCode are value-based', () {
      const a = KnowledgePageQuery(page: 1, limit: 20, type: 'DOCUMENT');
      const b = KnowledgePageQuery(page: 1, limit: 20, type: 'DOCUMENT');
      expect(a, equals(b));
      expect(a.hashCode, b.hashCode);
    });
  });

  group('KnowledgeSource.fromJson', () {
    test('defaults status to ACTIVE and config to an empty map when omitted', () {
      final source = KnowledgeSource.fromJson({
        'id': 'source-1',
        'type': 'DOCUMENTS',
        'name': 'Sales docs',
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      });

      expect(source.status, 'ACTIVE');
      expect(source.config, isEmpty);
    });
  });

  group('KnowledgeDocument.fromJson', () {
    test('defaults status to PENDING when omitted', () {
      final document = KnowledgeDocument.fromJson({
        'id': 'doc-1',
        'sourceId': 'source-1',
        'title': 'Q1 report',
        'contentType': 'application/pdf',
      });

      expect(document.status, 'PENDING');
      expect(document.metadata, isEmpty);
    });
  });

  group('KnowledgeSearchResult.fromJson', () {
    test('coerces confidence/scores from num to double and parses the nested citation', () {
      final result = KnowledgeSearchResult.fromJson({
        'chunkId': 'chunk-1',
        'content': 'Some indexed text',
        'confidence': 1,
        'semanticScore': 1,
        'citation': {
          'sourceId': 'source-1',
          'sourceType': 'DOCUMENTS',
          'sourceName': 'Sales docs',
          'documentId': 'doc-1',
          'documentTitle': 'Q1 report',
        },
      });

      expect(result.confidence, 1.0);
      expect(result.semanticScore, 1.0);
      expect(result.keywordScore, isNull);
      expect(result.citation.documentTitle, 'Q1 report');
    });
  });

  group('KnowledgeStats.fromJson', () {
    test('parses nested indexSize and retrieval stats', () {
      final stats = KnowledgeStats.fromJson({
        'indexSize': {
          'sourceCount': 2,
          'documentCount': 10,
          'chunkCount': 100,
          'entityCount': 5,
          'relationshipCount': 3,
        },
        'retrieval': {
          'searchCount': 50,
          'averageLatencyMs': 120,
          'hitRate': 0.9,
          'cacheHitRate': 0.5,
          'averageConfidence': 0.8,
        },
      });

      expect(stats.indexSize.documentCount, 10);
      expect(stats.retrieval.averageLatencyMs, 120.0);
    });
  });

  group('KnowledgeHealth.fromJson', () {
    test('defaults healthy to false and reasons to an empty list when omitted', () {
      final health = KnowledgeHealth.fromJson(const {});
      expect(health.healthy, isFalse);
      expect(health.reasons, isEmpty);
    });
  });

  group('mapToKnowledgeException', () {
    test('passes an existing KnowledgeException through unchanged', () {
      const original = KnowledgeException('already mapped');
      expect(mapToKnowledgeException(original), same(original));
    });

    test('uses the backend message for a NetworkException with a status code', () {
      const error = NetworkException(message: 'Source not found', statusCode: 404);
      expect(mapToKnowledgeException(error).message, 'Source not found');
    });

    test('falls back to a generic message for any other error type', () {
      expect(
        mapToKnowledgeException(StateError('boom')).message,
        'Unable to complete knowledge graph request.',
      );
    });
  });
}
