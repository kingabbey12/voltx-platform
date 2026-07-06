class KnowledgePageQuery {
  const KnowledgePageQuery({
    this.page = 1,
    this.limit = 20,
    this.type,
    this.status,
  });

  final int page;
  final int limit;
  final String? type;
  final String? status;

  Map<String, dynamic> toQueryParameters() {
    return {
      'page': page,
      'limit': limit,
      if (type != null) 'type': type,
      if (status != null) 'status': status,
    };
  }

  @override
  bool operator ==(Object other) {
    return other is KnowledgePageQuery &&
        other.page == page &&
        other.limit == limit &&
        other.type == type &&
        other.status == status;
  }

  @override
  int get hashCode => Object.hash(page, limit, type, status);
}

class PaginatedKnowledgeResult<T> {
  const PaginatedKnowledgeResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  factory PaginatedKnowledgeResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) parser,
  ) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => parser(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedKnowledgeResult<T>(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

/// A knowledge source (CRM record stream, uploaded documents, emails,
/// calendar, etc.) — the top-level container documents are indexed under.
class KnowledgeSource {
  const KnowledgeSource({
    required this.id,
    required this.type,
    required this.name,
    required this.status,
    required this.config,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.lastIndexedAt,
  });

  factory KnowledgeSource.fromJson(Map<String, dynamic> json) {
    return KnowledgeSource(
      id: json['id'] as String,
      type: json['type'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      status: json['status'] as String? ?? 'ACTIVE',
      config: Map<String, dynamic>.from(json['config'] as Map? ?? const {}),
      lastIndexedAt: json['lastIndexedAt'] as String?,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  final String id;
  final String type;
  final String name;
  final String? description;
  final String status;
  final Map<String, dynamic> config;
  final String? lastIndexedAt;
  final String createdAt;
  final String updatedAt;
}

/// One ingestible unit of content belonging to a [KnowledgeSource].
class KnowledgeDocument {
  const KnowledgeDocument({
    required this.id,
    required this.sourceId,
    required this.title,
    required this.contentType,
    required this.status,
    required this.metadata,
    this.externalId,
    this.indexedAt,
    this.error,
  });

  factory KnowledgeDocument.fromJson(Map<String, dynamic> json) {
    return KnowledgeDocument(
      id: json['id'] as String,
      sourceId: json['sourceId'] as String,
      externalId: json['externalId'] as String?,
      title: json['title'] as String,
      contentType: json['contentType'] as String,
      metadata: Map<String, dynamic>.from(json['metadata'] as Map? ?? const {}),
      status: json['status'] as String? ?? 'PENDING',
      indexedAt: json['indexedAt'] as String?,
      error: json['error'] as String?,
    );
  }

  final String id;
  final String sourceId;
  final String? externalId;
  final String title;
  final String contentType;
  final Map<String, dynamic> metadata;
  final String status;
  final String? indexedAt;
  final String? error;
}

class KnowledgeCitation {
  const KnowledgeCitation({
    required this.sourceId,
    required this.sourceType,
    required this.sourceName,
    required this.documentId,
    required this.documentTitle,
    this.externalId,
  });

  factory KnowledgeCitation.fromJson(Map<String, dynamic> json) {
    return KnowledgeCitation(
      sourceId: json['sourceId'] as String,
      sourceType: json['sourceType'] as String,
      sourceName: json['sourceName'] as String,
      documentId: json['documentId'] as String,
      documentTitle: json['documentTitle'] as String,
      externalId: json['externalId'] as String?,
    );
  }

  final String sourceId;
  final String sourceType;
  final String sourceName;
  final String documentId;
  final String documentTitle;
  final String? externalId;
}

class KnowledgeSearchResult {
  const KnowledgeSearchResult({
    required this.chunkId,
    required this.content,
    required this.confidence,
    required this.citation,
    this.semanticScore,
    this.keywordScore,
  });

  factory KnowledgeSearchResult.fromJson(Map<String, dynamic> json) {
    return KnowledgeSearchResult(
      chunkId: json['chunkId'] as String,
      content: json['content'] as String,
      confidence: (json['confidence'] as num).toDouble(),
      semanticScore: (json['semanticScore'] as num?)?.toDouble(),
      keywordScore: (json['keywordScore'] as num?)?.toDouble(),
      citation: KnowledgeCitation.fromJson(Map<String, dynamic>.from(json['citation'] as Map)),
    );
  }

  final String chunkId;
  final String content;
  final double confidence;
  final double? semanticScore;
  final double? keywordScore;
  final KnowledgeCitation citation;
}

class KnowledgeIndexSize {
  const KnowledgeIndexSize({
    required this.sourceCount,
    required this.documentCount,
    required this.chunkCount,
    required this.entityCount,
    required this.relationshipCount,
  });

  factory KnowledgeIndexSize.fromJson(Map<String, dynamic> json) {
    return KnowledgeIndexSize(
      sourceCount: json['sourceCount'] as int? ?? 0,
      documentCount: json['documentCount'] as int? ?? 0,
      chunkCount: json['chunkCount'] as int? ?? 0,
      entityCount: json['entityCount'] as int? ?? 0,
      relationshipCount: json['relationshipCount'] as int? ?? 0,
    );
  }

  final int sourceCount;
  final int documentCount;
  final int chunkCount;
  final int entityCount;
  final int relationshipCount;
}

class KnowledgeRetrievalStats {
  const KnowledgeRetrievalStats({
    required this.searchCount,
    required this.averageLatencyMs,
    required this.hitRate,
    required this.cacheHitRate,
    required this.averageConfidence,
  });

  factory KnowledgeRetrievalStats.fromJson(Map<String, dynamic> json) {
    return KnowledgeRetrievalStats(
      searchCount: json['searchCount'] as int? ?? 0,
      averageLatencyMs: (json['averageLatencyMs'] as num?)?.toDouble() ?? 0,
      hitRate: (json['hitRate'] as num?)?.toDouble() ?? 0,
      cacheHitRate: (json['cacheHitRate'] as num?)?.toDouble() ?? 0,
      averageConfidence: (json['averageConfidence'] as num?)?.toDouble() ?? 0,
    );
  }

  final int searchCount;
  final double averageLatencyMs;
  final double hitRate;
  final double cacheHitRate;
  final double averageConfidence;
}

class KnowledgeStats {
  const KnowledgeStats({
    required this.indexSize,
    required this.retrieval,
  });

  factory KnowledgeStats.fromJson(Map<String, dynamic> json) {
    return KnowledgeStats(
      indexSize: KnowledgeIndexSize.fromJson(Map<String, dynamic>.from(json['indexSize'] as Map)),
      retrieval:
          KnowledgeRetrievalStats.fromJson(Map<String, dynamic>.from(json['retrieval'] as Map)),
    );
  }

  final KnowledgeIndexSize indexSize;
  final KnowledgeRetrievalStats retrieval;
}

class KnowledgeHealth {
  const KnowledgeHealth({required this.healthy, required this.reasons});

  factory KnowledgeHealth.fromJson(Map<String, dynamic> json) {
    return KnowledgeHealth(
      healthy: json['healthy'] as bool? ?? false,
      reasons: (json['reasons'] as List<dynamic>? ?? const []).map((e) => e.toString()).toList(),
    );
  }

  final bool healthy;
  final List<String> reasons;
}
