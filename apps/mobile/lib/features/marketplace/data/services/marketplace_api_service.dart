import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/marketplace_models.dart';

class MarketplaceApiService {
  MarketplaceApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<PublicMarketplaceAppList> listPublished({
    String? category,
    String? search,
    int page = 1,
    int limit = 20,
  }) {
    return _apiClient.get(
      '/marketplace/public/apps',
      queryParameters: {
        'page': page,
        'limit': limit,
        'category': ?category,
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      },
      fromJson: PublicMarketplaceAppList.fromJson,
    );
  }

  Future<PublicMarketplaceApp> getPublished(String appId) {
    return _apiClient.get('/marketplace/public/apps/$appId', fromJson: PublicMarketplaceApp.fromJson);
  }

  Future<List<MarketplaceReview>> listPublicReviews(String appId) {
    return _apiClient.getListPlain(
      '/marketplace/public/apps/$appId/reviews',
      fromJson: MarketplaceReview.fromJson,
    );
  }

  Future<List<MarketplaceApp>> listMyApps(String organizationId) {
    return _apiClient.getListPlain(
      '/organizations/$organizationId/marketplace/apps',
      fromJson: MarketplaceApp.fromJson,
    );
  }

  Future<MarketplaceApp> createApp(
    String organizationId, {
    required String name,
    required String category,
    String? description,
    String? iconUrl,
  }) {
    return _apiClient.post(
      '/organizations/$organizationId/marketplace/apps',
      data: {
        'name': name,
        'category': category,
        'description': ?description,
        'iconUrl': ?iconUrl,
      },
      fromJson: MarketplaceApp.fromJson,
    );
  }

  Future<MarketplaceApp> getApp(String organizationId, String appId) {
    return _apiClient.get(
      '/organizations/$organizationId/marketplace/apps/$appId',
      fromJson: MarketplaceApp.fromJson,
    );
  }

  Future<List<MarketplaceAppVersion>> listVersions(String organizationId, String appId) {
    return _apiClient.getListPlain(
      '/organizations/$organizationId/marketplace/apps/$appId/versions',
      fromJson: MarketplaceAppVersion.fromJson,
    );
  }

  Future<MarketplaceAppVersion> createVersion(
    String organizationId,
    String appId, {
    required String version,
    required Map<String, dynamic> manifest,
    String? changelog,
    int? priceCents,
  }) {
    return _apiClient.post(
      '/organizations/$organizationId/marketplace/apps/$appId/versions',
      data: {
        'version': version,
        'manifest': manifest,
        'changelog': ?changelog,
        'priceCents': ?priceCents,
      },
      fromJson: MarketplaceAppVersion.fromJson,
    );
  }

  Future<List<ExtensionAiTool>> listAiTools(String organizationId, String appId) {
    return _apiClient.getListPlain(
      '/organizations/$organizationId/marketplace/apps/$appId/extensions/ai-tools',
      fromJson: ExtensionAiTool.fromJson,
    );
  }

  Future<List<MarketplaceInstall>> listInstalled(String organizationId) {
    return _apiClient.getListPlain(
      '/organizations/$organizationId/marketplace/installs',
      fromJson: MarketplaceInstall.fromJson,
    );
  }

  Future<InstallAppResult> install(String organizationId, String appId) {
    return _apiClient.post(
      '/organizations/$organizationId/marketplace/apps/$appId/install',
      data: const {},
      fromJson: InstallAppResult.fromJson,
    );
  }

  Future<void> uninstall(String organizationId, String installId) {
    return _apiClient.delete(
      '/organizations/$organizationId/marketplace/installs/$installId',
      fromJson: (json) => json,
    );
  }

  Future<MarketplaceReview> createReview(
    String organizationId,
    String appId, {
    required int rating,
    String? comment,
  }) {
    return _apiClient.post(
      '/organizations/$organizationId/marketplace/apps/$appId/reviews',
      data: {'rating': rating, 'comment': ?comment},
      fromJson: MarketplaceReview.fromJson,
    );
  }

  Future<String> createOnboardingLink(String organizationId) async {
    final result = await _apiClient.post(
      '/organizations/$organizationId/marketplace/connect/onboarding-link',
      fromJson: (json) => json['url'] as String,
    );
    return result;
  }

  Future<DeveloperConnectStatus> getConnectStatus(String organizationId) {
    return _apiClient.get(
      '/organizations/$organizationId/marketplace/connect/status',
      fromJson: DeveloperConnectStatus.fromJson,
    );
  }
}

MarketplaceException mapToMarketplaceException(Object error) {
  if (error is MarketplaceException) {
    return error;
  }
  if (error is NetworkException) {
    return MarketplaceException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const MarketplaceException('Unable to complete marketplace request.');
}

class MarketplaceException implements Exception {
  const MarketplaceException(this.message);

  final String message;

  @override
  String toString() => message;
}
