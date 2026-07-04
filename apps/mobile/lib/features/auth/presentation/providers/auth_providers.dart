import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
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

  void setUser(AuthUser? user) => state = user;

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
