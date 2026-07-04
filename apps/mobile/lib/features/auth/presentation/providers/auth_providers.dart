import 'package:flutter/foundation.dart';
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
    debugPrint('[AUTH][SESSION][restoreSession] start');
    final user = await _repository.restoreSession();
    if (user != null) {
      debugPrint('[AUTH][SESSION][restoreSession] restored user=${user.email}');
      state = user;
      return;
    }
    debugPrint('[AUTH][SESSION][restoreSession] no_session');
  }

  void setUser(AuthUser? user) {
    debugPrint('[AUTH][SESSION][setUser] user=${user?.email ?? 'null'}');
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

  String debugLabel = 'auth_form';

  void reset() => state = const AsyncData(null);

  Future<void> submit(Future<void> Function() action, {String? successMessage}) async {
    if (_isSubmitting) {
      debugPrint('[AUTH][FORM][$debugLabel] submit_ignored reason=inflight');
      return;
    }

    debugPrint('[AUTH][FORM][$debugLabel] submit_start');
    _isSubmitting = true;
    state = const AsyncLoading();
    try {
      await action();
      state = AsyncData(successMessage);
      debugPrint('[AUTH][FORM][$debugLabel] submit_success message=$successMessage');
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      debugPrint('[AUTH][FORM][$debugLabel] submit_error error=$error');
    } finally {
      _isSubmitting = false;
      debugPrint('[AUTH][FORM][$debugLabel] submit_end');
    }
  }
}

final signInFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) {
    final controller = AuthFormController();
    controller.debugLabel = 'sign_in';
    return controller;
  },
);

final signUpFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) {
    final controller = AuthFormController();
    controller.debugLabel = 'sign_up';
    return controller;
  },
);

final forgotPasswordFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) {
    final controller = AuthFormController();
    controller.debugLabel = 'forgot_password';
    return controller;
  },
);

final resetPasswordFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) {
    final controller = AuthFormController();
    controller.debugLabel = 'reset_password';
    return controller;
  },
);

final verifyEmailFormProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AsyncValue<String?>>(
  (ref) {
    final controller = AuthFormController();
    controller.debugLabel = 'verify_email';
    return controller;
  },
);

String authErrorMessage(Object error) {
  return AuthErrorMapper.toUiModel(error).message;
}
