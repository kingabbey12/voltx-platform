import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/repositories/mock_auth_repository.dart';
import '../../data/services/auth_api_service.dart';
import '../../data/models/auth_user.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return MockAuthRepository();
});

final authApiServiceProvider = Provider<AuthApiService>((ref) {
  return AuthApiService(ref.watch(dioProvider));
});

final authSessionProvider =
    StateNotifierProvider<AuthSessionNotifier, AuthUser?>((ref) {
  return AuthSessionNotifier(ref.watch(authRepositoryProvider));
});

class AuthSessionNotifier extends StateNotifier<AuthUser?> {
  AuthSessionNotifier(this._repository) : super(_repository.currentUser);

  final AuthRepository _repository;

  void setUser(AuthUser? user) => state = user;

  Future<void> signOut() async {
    await _repository.signOut();
    state = null;
  }
}

/// Generic async form submission state for auth screens.
class AuthFormController extends StateNotifier<AsyncValue<String?>> {
  AuthFormController() : super(const AsyncData(null));

  void reset() => state = const AsyncData(null);

  Future<void> submit(Future<void> Function() action, {String? successMessage}) async {
    state = const AsyncLoading();
    try {
      await action();
      state = AsyncData(successMessage);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
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
  if (error is AuthException) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
