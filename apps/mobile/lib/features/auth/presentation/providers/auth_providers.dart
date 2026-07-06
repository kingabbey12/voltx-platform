import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../../ai/presentation/providers/ai_providers.dart';
import '../../../dashboard/presentation/providers/dashboard_providers.dart';
import '../../../integrations/presentation/providers/integration_providers.dart';
import '../../../knowledge/presentation/providers/knowledge_providers.dart';
import '../../../sales/presentation/providers/sales_providers.dart';
import '../../../workflows/presentation/providers/workflow_providers.dart';
import '../../data/models/auth_organization_membership.dart';
import '../../data/models/auth_user.dart';
import '../../data/repositories/api_auth_repository.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/services/auth_api_service.dart';
import '../../data/services/auth_error_mapper.dart';

final authApiServiceProvider = Provider<AuthApiService>((ref) {
  return AuthApiService(ref.watch(apiClientProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return ApiAuthRepository(
    apiService: ref.watch(authApiServiceProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  );
});

final authSessionProvider =
    StateNotifierProvider<AuthSessionNotifier, AuthUser?>((ref) {
  return AuthSessionNotifier(ref.watch(authRepositoryProvider));
});

class AuthSessionNotifier extends StateNotifier<AuthUser?> {
  AuthSessionNotifier(this._repository) : super(_repository.currentUser);

  final AuthRepository _repository;

  Future<void> restoreSession() async {
    final user = await _repository.restoreSession();
    if (user != null) {
      state = user;
    }
  }

  void setUser(AuthUser? user) {
    state = user;
  }

  Future<void> signOut() async {
    await _repository.signOut();
    state = null;
  }
}

/// Generic async form submission state for auth screens.
class AuthFormController extends StateNotifier<AsyncValue<String?>> {
  AuthFormController() : super(const AsyncData(null));

  bool _isSubmitting = false;

  void reset() => state = const AsyncData(null);

  Future<void> submit(Future<void> Function() action, {String? successMessage}) async {
    if (_isSubmitting) {
      return;
    }

    _isSubmitting = true;
    state = const AsyncLoading();
    try {
      await action();
      state = AsyncData(successMessage);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
    } finally {
      _isSubmitting = false;
    }
  }
}

final signInFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) => AuthFormController(),
);

final signUpFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) => AuthFormController(),
);

final forgotPasswordFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) => AuthFormController(),
);

final resetPasswordFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) => AuthFormController(),
);

final verifyEmailFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) => AuthFormController(),
);

String authErrorMessage(Object error) {
  return AuthErrorMapper.toUiModel(error).message;
}

final myOrganizationsProvider = FutureProvider<List<AuthOrganizationMembership>>((ref) {
  return ref.watch(authRepositoryProvider).myOrganizations();
});

/// Every provider that is implicitly scoped to "whichever organization the
/// current session belongs to" — switching organizations without signing
/// out means none of these can be trusted to still reflect the new org
/// until invalidated. Invalidating a bare (non-family) provider reference
/// invalidates every family instance too, so this covers paginated/
/// parameterized providers without needing to enumerate their arguments.
///
/// Takes a [WidgetRef] (not a plain [Ref]) because it calls
/// [refreshDashboardData], which needs one — so this must be called from
/// the widget layer (e.g. right after a successful org switch or
/// invitation acceptance), not from inside a StateNotifier.
void invalidateOrganizationScopedProviders(WidgetRef ref) {
  // Sales / CRM
  ref.invalidate(companiesProvider);
  ref.invalidate(contactsProvider);
  ref.invalidate(leadsProvider);
  ref.invalidate(opportunitiesProvider);
  ref.invalidate(activitiesProvider);
  ref.invalidate(companyDetailProvider);
  ref.invalidate(contactDetailProvider);
  ref.invalidate(leadDetailProvider);

  // AI workspace
  ref.invalidate(agentsProvider);
  ref.invalidate(aiConversationsStoreProvider);
  ref.invalidate(memoriesProvider);
  ref.invalidate(knowledgeBasesProvider);
  ref.invalidate(availableToolsProvider);

  // Knowledge graph
  ref.invalidate(knowledgeSourcesProvider);
  ref.invalidate(knowledgeSourceDocumentsProvider);
  ref.invalidate(knowledgeStatsProvider);
  ref.invalidate(knowledgeHealthProvider);

  // Workflows
  ref.invalidate(workflowsProvider);
  ref.invalidate(workflowDetailProvider);
  ref.invalidate(workflowRunsProvider);
  ref.invalidate(workflowMetricsProvider);
  ref.invalidate(workflowHealthProvider);

  // Integrations
  ref.invalidate(integrationConnectionsProvider);
  ref.invalidate(integrationConnectionDetailProvider);
  ref.invalidate(integrationMetricsProvider);

  // Dashboard (derives from the above; also invalidates its own sources)
  refreshDashboardData(ref);

  // The list of orgs itself may have changed too (e.g. joined via invite).
  ref.invalidate(myOrganizationsProvider);
}

class OrgSwitchState {
  const OrgSwitchState({this.isLoading = false, this.errorMessage});

  final bool isLoading;
  final String? errorMessage;

  OrgSwitchState copyWith({bool? isLoading, String? errorMessage, bool clearError = false}) {
    return OrgSwitchState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

/// Switches the active organization without signing out. Callers should
/// call [invalidateOrganizationScopedProviders] immediately after a
/// successful switch (from the widget layer, once navigation/loading UI is
/// ready to show fresh data) — this controller only handles the session
/// swap itself.
class OrgSwitchController extends StateNotifier<OrgSwitchState> {
  OrgSwitchController(this._ref) : super(const OrgSwitchState());

  final Ref _ref;

  Future<bool> switchTo(String organizationId) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final user = await _ref.read(authRepositoryProvider).switchOrganization(organizationId);
      _ref.read(authSessionProvider.notifier).setUser(user);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: authErrorMessage(error));
      return false;
    }
  }
}

final orgSwitchControllerProvider =
    StateNotifierProvider.autoDispose<OrgSwitchController, OrgSwitchState>((ref) {
  return OrgSwitchController(ref);
});
