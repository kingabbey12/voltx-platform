const List<String> marketplaceAppCategories = [
  'PRODUCTIVITY',
  'ANALYTICS',
  'COMMUNICATION',
  'SALES',
  'FINANCE',
  'OTHER',
];

class PublicMarketplaceApp {
  const PublicMarketplaceApp({
    required this.id,
    required this.name,
    required this.category,
    required this.averageRating,
    required this.reviewCount,
    required this.createdAt,
    this.description,
    this.iconUrl,
    this.latestVersion,
    this.priceCents,
  });

  factory PublicMarketplaceApp.fromJson(Map<String, dynamic> json) {
    return PublicMarketplaceApp(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String,
      iconUrl: json['iconUrl'] as String?,
      latestVersion: json['latestVersion'] as String?,
      priceCents: json['priceCents'] as int?,
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      reviewCount: json['reviewCount'] as int? ?? 0,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String name;
  final String? description;
  final String category;
  final String? iconUrl;
  final String? latestVersion;
  final int? priceCents;
  final double averageRating;
  final int reviewCount;
  final String createdAt;
}

class PublicMarketplaceAppList {
  const PublicMarketplaceAppList({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory PublicMarketplaceAppList.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => PublicMarketplaceApp.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PublicMarketplaceAppList(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
    );
  }

  final List<PublicMarketplaceApp> items;
  final int total;
  final int page;
  final int limit;

  int get totalPages => limit == 0 ? 1 : (total / limit).ceil().clamp(1, 1 << 30);
}

class MarketplaceApp {
  const MarketplaceApp({
    required this.id,
    required this.developerOrganizationId,
    required this.name,
    required this.category,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.iconUrl,
  });

  factory MarketplaceApp.fromJson(Map<String, dynamic> json) {
    return MarketplaceApp(
      id: json['id'] as String,
      developerOrganizationId: json['developerOrganizationId'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      category: json['category'] as String,
      iconUrl: json['iconUrl'] as String?,
      status: json['status'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  final String id;
  final String developerOrganizationId;
  final String name;
  final String? description;
  final String category;
  final String? iconUrl;
  final String status;
  final String createdAt;
  final String updatedAt;
}

class MarketplaceAppVersion {
  const MarketplaceAppVersion({
    required this.id,
    required this.appId,
    required this.version,
    required this.priceCents,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.changelog,
    this.reviewedAt,
    this.rejectionReason,
  });

  factory MarketplaceAppVersion.fromJson(Map<String, dynamic> json) {
    return MarketplaceAppVersion(
      id: json['id'] as String,
      appId: json['appId'] as String,
      version: json['version'] as String,
      changelog: json['changelog'] as String?,
      priceCents: json['priceCents'] as int? ?? 0,
      status: json['status'] as String,
      reviewedAt: json['reviewedAt'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  final String id;
  final String appId;
  final String version;
  final String? changelog;
  final int priceCents;
  final String status;
  final String? reviewedAt;
  final String? rejectionReason;
  final String createdAt;
  final String updatedAt;
}

class MarketplaceInstall {
  const MarketplaceInstall({
    required this.id,
    required this.appId,
    required this.installedVersionId,
    required this.status,
    required this.createdAt,
  });

  factory MarketplaceInstall.fromJson(Map<String, dynamic> json) {
    return MarketplaceInstall(
      id: json['id'] as String,
      appId: json['appId'] as String,
      installedVersionId: json['installedVersionId'] as String,
      status: json['status'] as String,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String appId;
  final String installedVersionId;
  final String status;
  final String createdAt;
}

class InstallAppResult {
  const InstallAppResult({this.install, this.checkoutUrl});

  factory InstallAppResult.fromJson(Map<String, dynamic> json) {
    return InstallAppResult(
      install: json['install'] == null
          ? null
          : MarketplaceInstall.fromJson(Map<String, dynamic>.from(json['install'] as Map)),
      checkoutUrl: json['checkoutUrl'] as String?,
    );
  }

  final MarketplaceInstall? install;
  final String? checkoutUrl;
}

class MarketplaceReview {
  const MarketplaceReview({
    required this.id,
    required this.appId,
    required this.rating,
    required this.createdAt,
    this.comment,
  });

  factory MarketplaceReview.fromJson(Map<String, dynamic> json) {
    return MarketplaceReview(
      id: json['id'] as String,
      appId: json['appId'] as String,
      rating: json['rating'] as int,
      comment: json['comment'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String appId;
  final int rating;
  final String? comment;
  final String createdAt;
}

class DeveloperConnectStatus {
  const DeveloperConnectStatus({required this.onboardingStatus, required this.payoutsEnabled});

  factory DeveloperConnectStatus.fromJson(Map<String, dynamic> json) {
    return DeveloperConnectStatus(
      onboardingStatus: json['onboardingStatus'] as String? ?? 'PENDING',
      payoutsEnabled: json['payoutsEnabled'] as bool? ?? false,
    );
  }

  final String onboardingStatus;
  final bool payoutsEnabled;
}

class ExtensionAiTool {
  const ExtensionAiTool({
    required this.id,
    required this.name,
    required this.description,
    required this.endpointUrl,
    required this.signingSecret,
  });

  factory ExtensionAiTool.fromJson(Map<String, dynamic> json) {
    return ExtensionAiTool(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String,
      endpointUrl: json['endpointUrl'] as String,
      signingSecret: json['signingSecret'] as String,
    );
  }

  final String id;
  final String name;
  final String description;
  final String endpointUrl;
  final String signingSecret;
}
