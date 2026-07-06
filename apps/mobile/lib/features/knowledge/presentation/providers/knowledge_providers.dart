import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/knowledge_models.dart';
import '../../data/repositories/knowledge_repository.dart';
import '../../data/services/knowledge_api_service.dart';

final knowledgeApiServiceProvider = Provider<KnowledgeApiService>((ref) {
  return KnowledgeApiService(ref.watch(apiClientProvider));
});

final knowledgeRepositoryProvider = Provider<KnowledgeRepository>((ref) {
  return ApiKnowledgeRepository(ref.watch(knowledgeApiServiceProvider));
});

final knowledgeSourcesProvider =
    FutureProvider.family<PaginatedKnowledgeResult<KnowledgeSource>, KnowledgePageQuery>((ref, query) {
  return ref.watch(knowledgeRepositoryProvider).listSources(query);
});

final knowledgeSourceDocumentsProvider =
    FutureProvider.family<PaginatedKnowledgeResult<KnowledgeDocument>, String>((ref, sourceId) {
  return ref.watch(knowledgeRepositoryProvider).listDocuments(page: 1, limit: 50, sourceId: sourceId);
});

final knowledgeStatsProvider = FutureProvider<KnowledgeStats>((ref) {
  return ref.watch(knowledgeRepositoryProvider).getStats();
});

final knowledgeHealthProvider = FutureProvider<KnowledgeHealth>((ref) {
  return ref.watch(knowledgeRepositoryProvider).getHealth();
});

final knowledgeSearchQueryProvider = StateProvider<String>((ref) => '');

class KnowledgeSearchState {
  const KnowledgeSearchState({
    this.isLoading = false,
    this.results = const [],
    this.errorMessage,
    this.hasSearched = false,
  });

  final bool isLoading;
  final List<KnowledgeSearchResult> results;
  final String? errorMessage;
  final bool hasSearched;

  KnowledgeSearchState copyWith({
    bool? isLoading,
    List<KnowledgeSearchResult>? results,
    String? errorMessage,
    bool? hasSearched,
  }) {
    return KnowledgeSearchState(
      isLoading: isLoading ?? this.isLoading,
      results: results ?? this.results,
      errorMessage: errorMessage,
      hasSearched: hasSearched ?? this.hasSearched,
    );
  }
}

class KnowledgeSearchController extends StateNotifier<KnowledgeSearchState> {
  KnowledgeSearchController(this._repository) : super(const KnowledgeSearchState());

  final KnowledgeRepository _repository;

  Future<void> search(String query) async {
    if (query.trim().isEmpty) {
      state = const KnowledgeSearchState();
      return;
    }
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final results = await _repository.search(query.trim(), topK: 10);
      state = state.copyWith(isLoading: false, results: results, hasSearched: true);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString(), hasSearched: true);
    }
  }

  void clear() => state = const KnowledgeSearchState();
}

final knowledgeSearchControllerProvider =
    StateNotifierProvider<KnowledgeSearchController, KnowledgeSearchState>((ref) {
  return KnowledgeSearchController(ref.watch(knowledgeRepositoryProvider));
});
