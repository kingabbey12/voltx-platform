import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/marketplace_models.dart';
import '../../data/repositories/marketplace_repository.dart';
import '../../data/services/marketplace_api_service.dart';

final marketplaceApiServiceProvider = Provider<MarketplaceApiService>((ref) {
  return MarketplaceApiService(ref.watch(apiClientProvider));
});

final marketplaceRepositoryProvider = Provider<MarketplaceRepository>((ref) {
  return ApiMarketplaceRepository(ref.watch(marketplaceApiServiceProvider));
});

class PublishedAppsQuery {
  const PublishedAppsQuery({this.page = 1, this.limit = 20, this.category, this.search});

  final int page;
  final int limit;
  final String? category;
  final String? search;

  @override
  bool operator ==(Object other) {
    return other is PublishedAppsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.category == category &&
        other.search == search;
  }

  @override
  int get hashCode => Object.hash(page, limit, category, search);
}

final publishedAppsProvider =
    FutureProvider.family<PublicMarketplaceAppList, PublishedAppsQuery>((ref, query) {
  return ref.watch(marketplaceRepositoryProvider).listPublished(
        category: query.category,
        search: query.search,
        page: query.page,
        limit: query.limit,
      );
});

final publishedAppDetailProvider = FutureProvider.family<PublicMarketplaceApp, String>((ref, appId) {
  return ref.watch(marketplaceRepositoryProvider).getPublished(appId);
});

final publicReviewsProvider = FutureProvider.family<List<MarketplaceReview>, String>((ref, appId) {
  return ref.watch(marketplaceRepositoryProvider).listPublicReviews(appId);
});

final installedAppsProvider = FutureProvider<List<MarketplaceInstall>>((ref) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    throw StateError('No active organization');
  }
  return ref.watch(marketplaceRepositoryProvider).listInstalled(organizationId);
});

final myAppsProvider = FutureProvider<List<MarketplaceApp>>((ref) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    throw StateError('No active organization');
  }
  return ref.watch(marketplaceRepositoryProvider).listMyApps(organizationId);
});

final myAppVersionsProvider = FutureProvider.family<List<MarketplaceAppVersion>, String>((ref, appId) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    throw StateError('No active organization');
  }
  return ref.watch(marketplaceRepositoryProvider).listVersions(organizationId, appId);
});

final myAppAiToolsProvider = FutureProvider.family<List<ExtensionAiTool>, String>((ref, appId) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    throw StateError('No active organization');
  }
  return ref.watch(marketplaceRepositoryProvider).listAiTools(organizationId, appId);
});

final connectStatusProvider = FutureProvider<DeveloperConnectStatus>((ref) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    throw StateError('No active organization');
  }
  return ref.watch(marketplaceRepositoryProvider).getConnectStatus(organizationId);
});

/// Drives every Marketplace mutation (install/uninstall, review, app/version
/// creation, Connect onboarding) with a loading flag and error surface,
/// invalidating affected providers on success.
class MarketplaceActionState {
  const MarketplaceActionState({this.isLoading = false, this.errorMessage});

  final bool isLoading;
  final String? errorMessage;

  MarketplaceActionState copyWith({bool? isLoading, String? errorMessage, bool clearError = false}) {
    return MarketplaceActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class MarketplaceActionController extends StateNotifier<MarketplaceActionState> {
  MarketplaceActionController(this._ref) : super(const MarketplaceActionState());

  final Ref _ref;

  MarketplaceRepository get _repository => _ref.read(marketplaceRepositoryProvider);

  String? get _organizationId => _ref.read(authSessionProvider)?.organizationId;

  Future<InstallAppResult?> install(String appId) async {
    final organizationId = _organizationId;
    if (organizationId == null) return null;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.install(organizationId, appId);
      _ref.invalidate(installedAppsProvider);
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<bool> uninstall(String installId) async {
    final organizationId = _organizationId;
    if (organizationId == null) return false;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.uninstall(organizationId, installId);
      _ref.invalidate(installedAppsProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> createReview(String appId, {required int rating, String? comment}) async {
    final organizationId = _organizationId;
    if (organizationId == null) return false;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.createReview(organizationId, appId, rating: rating, comment: comment);
      _ref.invalidate(publicReviewsProvider(appId));
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<MarketplaceApp?> createApp({
    required String name,
    required String category,
    String? description,
  }) async {
    final organizationId = _organizationId;
    if (organizationId == null) return null;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result =
          await _repository.createApp(organizationId, name: name, category: category, description: description);
      _ref.invalidate(myAppsProvider);
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<MarketplaceAppVersion?> createVersion(
    String appId, {
    required String version,
    required Map<String, dynamic> manifest,
    String? changelog,
    int? priceCents,
  }) async {
    final organizationId = _organizationId;
    if (organizationId == null) return null;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.createVersion(
        organizationId,
        appId,
        version: version,
        manifest: manifest,
        changelog: changelog,
        priceCents: priceCents,
      );
      _ref.invalidate(myAppVersionsProvider(appId));
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<String?> createOnboardingLink() async {
    final organizationId = _organizationId;
    if (organizationId == null) return null;
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final url = await _repository.createOnboardingLink(organizationId);
      state = state.copyWith(isLoading: false);
      return url;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }
}

final marketplaceActionControllerProvider =
    StateNotifierProvider<MarketplaceActionController, MarketplaceActionState>((ref) {
  return MarketplaceActionController(ref);
});
