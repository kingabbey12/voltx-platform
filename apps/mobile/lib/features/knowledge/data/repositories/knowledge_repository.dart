import '../models/knowledge_models.dart';
import '../services/knowledge_api_service.dart';

abstract class KnowledgeRepository {
  Future<PaginatedKnowledgeResult<KnowledgeSource>> listSources(KnowledgePageQuery query);
  Future<KnowledgeSource> getSource(String id);
  Future<KnowledgeSource> createSource({
    required String type,
    required String name,
    String? description,
    Map<String, dynamic>? config,
  });
  Future<KnowledgeSource> updateSource(String id, {String? name, String? description, String? status});
  Future<KnowledgeSource> deleteSource(String id);
  Future<void> reindexSource(String id);
  Future<PaginatedKnowledgeResult<KnowledgeDocument>> listDocuments({
    required int page,
    required int limit,
    String? sourceId,
    String? status,
  });
  Future<KnowledgeDocument> getDocument(String id);
  Future<List<KnowledgeSearchResult>> search(
    String query, {
    int? topK,
    double? minConfidence,
    List<String>? sourceIds,
    List<String>? sourceTypes,
  });
  Future<KnowledgeStats> getStats();
  Future<KnowledgeHealth> getHealth();
}

class ApiKnowledgeRepository implements KnowledgeRepository {
  ApiKnowledgeRepository(this._api);

  final KnowledgeApiService _api;

  @override
  Future<PaginatedKnowledgeResult<KnowledgeSource>> listSources(KnowledgePageQuery query) async {
    try {
      return await _api.listSources(query);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<KnowledgeSource> getSource(String id) async {
    try {
      return await _api.getSource(id);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<KnowledgeSource> createSource({
    required String type,
    required String name,
    String? description,
    Map<String, dynamic>? config,
  }) async {
    try {
      return await _api.createSource(type: type, name: name, description: description, config: config);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<KnowledgeSource> updateSource(
    String id, {
    String? name,
    String? description,
    String? status,
  }) async {
    try {
      return await _api.updateSource(id, name: name, description: description, status: status);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<KnowledgeSource> deleteSource(String id) async {
    try {
      return await _api.deleteSource(id);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<void> reindexSource(String id) async {
    try {
      await _api.reindexSource(id);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<PaginatedKnowledgeResult<KnowledgeDocument>> listDocuments({
    required int page,
    required int limit,
    String? sourceId,
    String? status,
  }) async {
    try {
      return await _api.listDocuments(page: page, limit: limit, sourceId: sourceId, status: status);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<KnowledgeDocument> getDocument(String id) async {
    try {
      return await _api.getDocument(id);
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<List<KnowledgeSearchResult>> search(
    String query, {
    int? topK,
    double? minConfidence,
    List<String>? sourceIds,
    List<String>? sourceTypes,
  }) async {
    try {
      return await _api.search(
        query,
        topK: topK,
        minConfidence: minConfidence,
        sourceIds: sourceIds,
        sourceTypes: sourceTypes,
      );
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<KnowledgeStats> getStats() async {
    try {
      return await _api.getStats();
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }

  @override
  Future<KnowledgeHealth> getHealth() async {
    try {
      return await _api.getHealth();
    } catch (error) {
      throw mapToKnowledgeException(error);
    }
  }
}
