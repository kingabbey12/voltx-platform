import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/knowledge_models.dart';

class KnowledgeApiService {
  KnowledgeApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<PaginatedKnowledgeResult<KnowledgeSource>> listSources(KnowledgePageQuery query) {
    return _apiClient.get(
      '/knowledge/sources',
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedKnowledgeResult.fromJson(json, KnowledgeSource.fromJson),
    );
  }

  Future<KnowledgeSource> getSource(String id) {
    return _apiClient.get(
      '/knowledge/sources/$id',
      fromJson: KnowledgeSource.fromJson,
    );
  }

  Future<KnowledgeSource> createSource({
    required String type,
    required String name,
    String? description,
    Map<String, dynamic>? config,
  }) {
    return _apiClient.post(
      '/knowledge/sources',
      data: {
        'type': type,
        'name': name,
        if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
        'config': ?config,
      },
      fromJson: KnowledgeSource.fromJson,
    );
  }

  Future<KnowledgeSource> updateSource(
    String id, {
    String? name,
    String? description,
    String? status,
  }) {
    return _apiClient.patch(
      '/knowledge/sources/$id',
      data: {
        'name': ?name,
        'description': ?description,
        'status': ?status,
      },
      fromJson: KnowledgeSource.fromJson,
    );
  }

  Future<KnowledgeSource> deleteSource(String id) {
    return _apiClient.delete(
      '/knowledge/sources/$id',
      fromJson: KnowledgeSource.fromJson,
    );
  }

  Future<Map<String, dynamic>> reindexSource(String id) {
    return _apiClient.post(
      '/knowledge/sources/$id/reindex',
      fromJson: (json) => json,
    );
  }

  Future<PaginatedKnowledgeResult<KnowledgeDocument>> listDocuments({
    required int page,
    required int limit,
    String? sourceId,
    String? status,
  }) {
    return _apiClient.get(
      '/knowledge/documents',
      queryParameters: {
        'page': page,
        'limit': limit,
        'sourceId': ?sourceId,
        'status': ?status,
      },
      fromJson: (json) => PaginatedKnowledgeResult.fromJson(json, KnowledgeDocument.fromJson),
    );
  }

  Future<KnowledgeDocument> getDocument(String id) {
    return _apiClient.get(
      '/knowledge/documents/$id',
      fromJson: KnowledgeDocument.fromJson,
    );
  }

  Future<List<KnowledgeSearchResult>> search(
    String query, {
    int? topK,
    double? minConfidence,
    List<String>? sourceIds,
    List<String>? sourceTypes,
  }) {
    return _apiClient.postList(
      '/knowledge/search',
      data: {
        'query': query,
        'topK': ?topK,
        'minConfidence': ?minConfidence,
        if (sourceIds != null && sourceIds.isNotEmpty) 'sourceIds': sourceIds,
        if (sourceTypes != null && sourceTypes.isNotEmpty) 'sourceTypes': sourceTypes,
      },
      fromJson: KnowledgeSearchResult.fromJson,
    );
  }

  Future<KnowledgeStats> getStats() {
    return _apiClient.get(
      '/knowledge/stats',
      fromJson: KnowledgeStats.fromJson,
    );
  }

  Future<KnowledgeHealth> getHealth() {
    return _apiClient.get(
      '/knowledge/health',
      fromJson: KnowledgeHealth.fromJson,
    );
  }
}

KnowledgeException mapToKnowledgeException(Object error) {
  if (error is KnowledgeException) {
    return error;
  }
  if (error is NetworkException) {
    return KnowledgeException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const KnowledgeException('Unable to complete knowledge graph request.');
}

class KnowledgeException implements Exception {
  const KnowledgeException(this.message);

  final String message;

  @override
  String toString() => message;
}
