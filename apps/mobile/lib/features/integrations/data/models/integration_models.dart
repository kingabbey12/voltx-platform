const List<String> integrationProviderKeys = [
  'GOOGLE_GMAIL',
  'GOOGLE_CALENDAR',
  'GOOGLE_DRIVE',
  'MICROSOFT_OUTLOOK',
  'MICROSOFT_CALENDAR',
  'MICROSOFT_ONEDRIVE',
  'SLACK',
  'MICROSOFT_TEAMS',
  'GITHUB',
  'STRIPE',
  'WEBHOOK',
  'REST_API',
];

/// Providers connected purely via API key / webhook secret (no OAuth
/// redirect flow needed) — these can be created directly from the
/// "Connect" form; everything else requires [IntegrationApiService.
/// initiateOAuth]/`completeOAuth`, which needs a redirect URI this mobile
/// app doesn't yet host, so those providers are shown as "coming soon"
/// until a deep-link redirect target exists.
const List<String> apiKeyProviderKeys = ['STRIPE', 'WEBHOOK', 'REST_API'];

class IntegrationPageQuery {
  const IntegrationPageQuery({this.page = 1, this.limit = 20, this.provider, this.status});

  final int page;
  final int limit;
  final String? provider;
  final String? status;

  Map<String, dynamic> toQueryParameters() {
    return {
      'page': page,
      'limit': limit,
      if (provider != null) 'provider': provider,
      if (status != null) 'status': status,
    };
  }

  @override
  bool operator ==(Object other) {
    return other is IntegrationPageQuery &&
        other.page == page &&
        other.limit == limit &&
        other.provider == provider &&
        other.status == status;
  }

  @override
  int get hashCode => Object.hash(page, limit, provider, status);
}

class PaginatedIntegrationResult<T> {
  const PaginatedIntegrationResult({
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

  factory PaginatedIntegrationResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) parser,
  ) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => parser(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedIntegrationResult<T>(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

class IntegrationConnection {
  const IntegrationConnection({
    required this.id,
    required this.provider,
    required this.displayName,
    required this.authType,
    required this.status,
    required this.version,
    required this.lastHealthStatus,
    required this.createdAt,
    required this.updatedAt,
    this.externalAccountId,
    this.lastHealthCheckAt,
    this.lastSyncAt,
    this.lastError,
  });

  factory IntegrationConnection.fromJson(Map<String, dynamic> json) {
    return IntegrationConnection(
      id: json['id'] as String,
      provider: json['provider'] as String,
      displayName: json['displayName'] as String,
      authType: json['authType'] as String,
      status: json['status'] as String,
      externalAccountId: json['externalAccountId'] as String?,
      version: json['version'] as int? ?? 0,
      lastHealthCheckAt: json['lastHealthCheckAt'] as String?,
      lastHealthStatus: json['lastHealthStatus'] as String? ?? 'UNKNOWN',
      lastSyncAt: json['lastSyncAt'] as String?,
      lastError: json['lastError'] as String?,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  final String id;
  final String provider;
  final String displayName;
  final String authType;
  final String status;
  final String? externalAccountId;
  final int version;
  final String? lastHealthCheckAt;
  final String lastHealthStatus;
  final String? lastSyncAt;
  final String? lastError;
  final String createdAt;
  final String updatedAt;

  bool get isConnected => status == 'CONNECTED';
}

class IntegrationHealthResult {
  const IntegrationHealthResult({required this.healthy, required this.latencyMs, this.message});

  factory IntegrationHealthResult.fromJson(Map<String, dynamic> json) {
    return IntegrationHealthResult(
      healthy: json['healthy'] as bool? ?? false,
      latencyMs: json['latencyMs'] as int? ?? 0,
      message: json['message'] as String?,
    );
  }

  final bool healthy;
  final int latencyMs;
  final String? message;
}

class IntegrationSyncResult {
  const IntegrationSyncResult({
    required this.itemsProcessed,
    required this.itemsFailed,
    required this.status,
  });

  factory IntegrationSyncResult.fromJson(Map<String, dynamic> json) {
    return IntegrationSyncResult(
      itemsProcessed: json['itemsProcessed'] as int? ?? 0,
      itemsFailed: json['itemsFailed'] as int? ?? 0,
      status: json['status'] as String? ?? 'SUCCEEDED',
    );
  }

  final int itemsProcessed;
  final int itemsFailed;
  final String status;
}

class IntegrationMetrics {
  const IntegrationMetrics({
    required this.totalCalls,
    required this.failedCalls,
    required this.totalRetries,
    required this.averageDurationMs,
    required this.totalSyncRuns,
    required this.failedSyncRuns,
    required this.totalEvents,
    required this.lastHealthStatus,
    this.minRateLimitRemaining,
    this.lastHealthCheckAt,
  });

  factory IntegrationMetrics.fromJson(Map<String, dynamic> json) {
    return IntegrationMetrics(
      totalCalls: json['totalCalls'] as int? ?? 0,
      failedCalls: json['failedCalls'] as int? ?? 0,
      totalRetries: json['totalRetries'] as int? ?? 0,
      averageDurationMs: (json['averageDurationMs'] as num?)?.toDouble() ?? 0,
      minRateLimitRemaining: json['minRateLimitRemaining'] as int?,
      totalSyncRuns: json['totalSyncRuns'] as int? ?? 0,
      failedSyncRuns: json['failedSyncRuns'] as int? ?? 0,
      totalEvents: json['totalEvents'] as int? ?? 0,
      lastHealthStatus: json['lastHealthStatus'] as String? ?? 'UNKNOWN',
      lastHealthCheckAt: json['lastHealthCheckAt'] as String?,
    );
  }

  final int totalCalls;
  final int failedCalls;
  final int totalRetries;
  final double averageDurationMs;
  final int? minRateLimitRemaining;
  final int totalSyncRuns;
  final int failedSyncRuns;
  final int totalEvents;
  final String lastHealthStatus;
  final String? lastHealthCheckAt;
}
