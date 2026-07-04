import 'package:flutter/foundation.dart';

import '../../../../core/storage/token_storage.dart';
import '../models/auth_tokens.dart';
import '../models/auth_user.dart';
import '../services/auth_api_service.dart';
import 'auth_repository.dart';

/// API-backed auth repository with secure token persistence.
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository({
    required this.apiService,
    required this.tokenStorage,
  });

  final AuthApiService apiService;
  final TokenStorage tokenStorage;

  AuthUser? _currentUser;

  @override
  AuthUser? get currentUser => _currentUser;

  @override
  Future<AuthUser?> restoreSession() async {
    debugPrint('[AUTH][REPO][restoreSession] start');
    final refreshToken = await tokenStorage.readRefreshToken();
    final accessToken = await tokenStorage.readAccessToken();
    debugPrint('[AUTH][REPO][restoreSession] hasRefresh=${refreshToken != null && refreshToken.isNotEmpty} hasAccess=${accessToken != null && accessToken.isNotEmpty}');

    if (refreshToken == null && accessToken == null) {
      debugPrint('[AUTH][REPO][restoreSession] no_tokens');
      return null;
    }

    try {
      debugPrint('[AUTH][REPO][restoreSession] getMe_attempt');
      final user = await apiService.getMe();
      _currentUser = user;
      debugPrint('[AUTH][REPO][restoreSession] getMe_success user=${user.email}');
      return user;
    } catch (_) {
      debugPrint('[AUTH][REPO][restoreSession] getMe_failed');
      if (refreshToken == null) {
        await tokenStorage.clear();
        debugPrint('[AUTH][REPO][restoreSession] cleared_tokens_no_refresh');
        return null;
      }

      try {
        debugPrint('[AUTH][REPO][restoreSession] refresh_attempt');
        final tokens = await apiService.refresh(refreshToken: refreshToken);
        await tokenStorage.saveTokens(
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        );
        final user = await apiService.getMe();
        _currentUser = user;
        debugPrint('[AUTH][REPO][restoreSession] refresh_success user=${user.email}');
        return user;
      } catch (_) {
        await tokenStorage.clear();
        _currentUser = null;
        debugPrint('[AUTH][REPO][restoreSession] refresh_failed_cleared');
        return null;
      }
    }
  }

  @override
  Future<AuthUser> signIn({
    required String email,
    required String password,
  }) async {
    debugPrint('[AUTH][REPO][signIn] called email=${email.trim()}');
    debugPrintStack(label: '[AUTH][REPO][signIn] stack', maxFrames: 20);
    try {
      final result = await apiService.login(
        email: email.trim(),
        password: password,
      );
      await _persistSession(result.tokens, result.user);
      debugPrint('[AUTH][REPO][signIn] success email=${result.user.email}');
      return result.user;
    } catch (error) {
      debugPrint('[AUTH][REPO][signIn] error error=$error');
      throw mapToAuthException(error);
    }
  }

  @override
  Future<AuthUser> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    try {
      final result = await apiService.register(
        email: email.trim(),
        password: password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      );
      await _persistSession(result.tokens, result.user);
      return result.user;
    } catch (error) {
      throw mapToAuthException(error);
    }
  }

  @override
  Future<void> forgotPassword({required String email}) async {
    try {
      await apiService.requestPasswordReset(email: email.trim());
    } catch (error) {
      throw mapToAuthException(error);
    }
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    try {
      await apiService.resetPassword(token: token.trim(), password: password);
    } catch (error) {
      throw mapToAuthException(error);
    }
  }

  @override
  Future<void> verifyEmail({required String token}) async {
    try {
      await apiService.verifyEmail(token: token.trim());
      if (_currentUser != null) {
        _currentUser = _currentUser!.copyWith(emailVerified: true);
      }
    } catch (error) {
      throw mapToAuthException(error);
    }
  }

  @override
  Future<void> signOut() async {
    final refreshToken = await tokenStorage.readRefreshToken();
    if (refreshToken != null) {
      try {
        await apiService.logout(refreshToken: refreshToken);
      } catch (_) {
        // Local session should still be cleared when logout fails remotely.
      }
    }

    await tokenStorage.clear();
    _currentUser = null;
  }

  Future<void> _persistSession(AuthTokens tokens, AuthUser user) async {
    await tokenStorage.saveTokens(
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    );
    _currentUser = user;
  }
}
