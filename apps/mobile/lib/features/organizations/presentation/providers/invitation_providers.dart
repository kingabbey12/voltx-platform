import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/invitation_models.dart';
import '../../data/repositories/invitation_repository.dart';
import '../../data/services/invitation_api_service.dart';

final invitationApiServiceProvider = Provider<InvitationApiService>((ref) {
  return InvitationApiService(ref.watch(apiClientProvider));
});

final invitationRepositoryProvider = Provider<InvitationRepository>((ref) {
  return ApiInvitationRepository(ref.watch(invitationApiServiceProvider));
});

final invitableRolesProvider = FutureProvider<List<OrganizationRole>>((ref) {
  return ref.watch(invitationRepositoryProvider).listInvitableRoles();
});

final invitationsProvider = FutureProvider.family<
    PaginatedInvitationsResult<Invitation>, InvitationPageQuery>((ref, query) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    return Future.value(
      const PaginatedInvitationsResult(items: [], total: 0, page: 1, limit: 20, totalPages: 0),
    );
  }
  return ref.watch(invitationRepositoryProvider).listInvitations(organizationId, query);
});

class InvitationActionState {
  const InvitationActionState({this.isLoading = false, this.errorMessage, this.lastLink});

  final bool isLoading;
  final String? errorMessage;
  final String? lastLink;

  InvitationActionState copyWith({
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    String? lastLink,
    bool clearLink = false,
  }) {
    return InvitationActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      lastLink: clearLink ? null : (lastLink ?? this.lastLink),
    );
  }
}

class InvitationActionController extends StateNotifier<InvitationActionState> {
  InvitationActionController(this._ref) : super(const InvitationActionState());

  final Ref _ref;

  InvitationRepository get _repository => _ref.read(invitationRepositoryProvider);

  Future<bool> invite({required String email, required String roleId}) async {
    final organizationId = _ref.read(authSessionProvider)?.organizationId;
    if (organizationId == null) {
      return false;
    }
    state = state.copyWith(isLoading: true, clearError: true, clearLink: true);
    try {
      final invitation = await _repository.createInvitation(
        organizationId,
        email: email,
        roleId: roleId,
      );
      _ref.invalidate(invitationsProvider);
      state = state.copyWith(isLoading: false, lastLink: invitation.invitationLink);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<void> resend(String invitationId) async {
    final organizationId = _ref.read(authSessionProvider)?.organizationId;
    if (organizationId == null) {
      return;
    }
    state = state.copyWith(isLoading: true, clearError: true, clearLink: true);
    try {
      final invitation = await _repository.resendInvitation(organizationId, invitationId);
      _ref.invalidate(invitationsProvider);
      state = state.copyWith(isLoading: false, lastLink: invitation.invitationLink);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> revoke(String invitationId) async {
    final organizationId = _ref.read(authSessionProvider)?.organizationId;
    if (organizationId == null) {
      return;
    }
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.revokeInvitation(organizationId, invitationId);
      _ref.invalidate(invitationsProvider);
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  void clearError() => state = state.copyWith(clearError: true);
}

final invitationActionControllerProvider =
    StateNotifierProvider<InvitationActionController, InvitationActionState>((ref) {
  return InvitationActionController(ref);
});

final invitationPreviewProvider =
    FutureProvider.family<InvitationPreview, String>((ref, token) {
  return ref.watch(invitationRepositoryProvider).previewInvitation(token);
});

class AcceptInvitationController extends StateNotifier<AsyncValue<AcceptInvitationResult?>> {
  AcceptInvitationController(this._ref) : super(const AsyncData(null));

  final Ref _ref;

  Future<void> accept(
    String token, {
    String? password,
    String? firstName,
    String? lastName,
  }) async {
    state = const AsyncLoading();
    try {
      final result = await _ref.read(invitationRepositoryProvider).acceptInvitation(
            token,
            password: password,
            firstName: firstName,
            lastName: lastName,
          );

      if (result is AcceptInvitationNewAccount) {
        await _ref.read(tokenStorageProvider).saveTokens(
              accessToken: result.tokens.accessToken,
              refreshToken: result.tokens.refreshToken,
            );
        _ref.read(authSessionProvider.notifier).setUser(result.user);
        // Org-scoped providers are invalidated by the screen (needs a
        // WidgetRef) once it observes this state transition to data.
      }

      state = AsyncData(result);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
    }
  }

  void reset() => state = const AsyncData(null);
}

final acceptInvitationControllerProvider = StateNotifierProvider.autoDispose<
    AcceptInvitationController, AsyncValue<AcceptInvitationResult?>>((ref) {
  return AcceptInvitationController(ref);
});
