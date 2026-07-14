import '../models/marketplace_models.dart';
import '../services/marketplace_api_service.dart';

abstract class MarketplaceRepository {
  Future<PublicMarketplaceAppList> listPublished({String? category, String? search, int page, int limit});
  Future<PublicMarketplaceApp> getPublished(String appId);
  Future<List<MarketplaceReview>> listPublicReviews(String appId);
  Future<List<MarketplaceApp>> listMyApps(String organizationId);
  Future<MarketplaceApp> createApp(
    String organizationId, {
    required String name,
    required String category,
    String? description,
    String? iconUrl,
  });
  Future<MarketplaceApp> getApp(String organizationId, String appId);
  Future<List<MarketplaceAppVersion>> listVersions(String organizationId, String appId);
  Future<MarketplaceAppVersion> createVersion(
    String organizationId,
    String appId, {
    required String version,
    required Map<String, dynamic> manifest,
    String? changelog,
    int? priceCents,
  });
  Future<List<ExtensionAiTool>> listAiTools(String organizationId, String appId);
  Future<List<MarketplaceInstall>> listInstalled(String organizationId);
  Future<InstallAppResult> install(String organizationId, String appId);
  Future<void> uninstall(String organizationId, String installId);
  Future<MarketplaceReview> createReview(
    String organizationId,
    String appId, {
    required int rating,
    String? comment,
  });
  Future<String> createOnboardingLink(String organizationId);
  Future<DeveloperConnectStatus> getConnectStatus(String organizationId);
}

class ApiMarketplaceRepository implements MarketplaceRepository {
  ApiMarketplaceRepository(this._api);

  final MarketplaceApiService _api;

  @override
  Future<PublicMarketplaceAppList> listPublished({
    String? category,
    String? search,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      return await _api.listPublished(category: category, search: search, page: page, limit: limit);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<PublicMarketplaceApp> getPublished(String appId) async {
    try {
      return await _api.getPublished(appId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<List<MarketplaceReview>> listPublicReviews(String appId) async {
    try {
      return await _api.listPublicReviews(appId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<List<MarketplaceApp>> listMyApps(String organizationId) async {
    try {
      return await _api.listMyApps(organizationId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<MarketplaceApp> createApp(
    String organizationId, {
    required String name,
    required String category,
    String? description,
    String? iconUrl,
  }) async {
    try {
      return await _api.createApp(
        organizationId,
        name: name,
        category: category,
        description: description,
        iconUrl: iconUrl,
      );
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<MarketplaceApp> getApp(String organizationId, String appId) async {
    try {
      return await _api.getApp(organizationId, appId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<List<MarketplaceAppVersion>> listVersions(String organizationId, String appId) async {
    try {
      return await _api.listVersions(organizationId, appId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<MarketplaceAppVersion> createVersion(
    String organizationId,
    String appId, {
    required String version,
    required Map<String, dynamic> manifest,
    String? changelog,
    int? priceCents,
  }) async {
    try {
      return await _api.createVersion(
        organizationId,
        appId,
        version: version,
        manifest: manifest,
        changelog: changelog,
        priceCents: priceCents,
      );
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<List<ExtensionAiTool>> listAiTools(String organizationId, String appId) async {
    try {
      return await _api.listAiTools(organizationId, appId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<List<MarketplaceInstall>> listInstalled(String organizationId) async {
    try {
      return await _api.listInstalled(organizationId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<InstallAppResult> install(String organizationId, String appId) async {
    try {
      return await _api.install(organizationId, appId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<void> uninstall(String organizationId, String installId) async {
    try {
      await _api.uninstall(organizationId, installId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<MarketplaceReview> createReview(
    String organizationId,
    String appId, {
    required int rating,
    String? comment,
  }) async {
    try {
      return await _api.createReview(organizationId, appId, rating: rating, comment: comment);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<String> createOnboardingLink(String organizationId) async {
    try {
      return await _api.createOnboardingLink(organizationId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }

  @override
  Future<DeveloperConnectStatus> getConnectStatus(String organizationId) async {
    try {
      return await _api.getConnectStatus(organizationId);
    } catch (error) {
      throw mapToMarketplaceException(error);
    }
  }
}
