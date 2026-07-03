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
    final refreshToken = await tokenStorage.readRefreshToken();
    final accessToken = await tokenStorage.readAccessToken();

    if (refreshToken == null && accessToken == null) {
      return null;
    }

    try {
      final user = await apiService.getMe();
      _currentUser = user;
      return user;
    } catch (_) {
      if (refreshToken == null) {
        await tokenStorage.clear();
        return null;
      }

      try {
        final tokens = await apiService.refresh(refreshToken: refreshToken);
        await tokenStorage.saveTokens(
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        );
        final user = await apiService.getMe();
        _currentUser = user;
        return user;
      } catch (_) {
        await tokenStorage.clear();
        _currentUser = null;
        return null;
      }
    }
  }

  @override
  Future<AuthUser> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final result = await apiService.login(
        email: email.trim(),
        password: password,
      );
      await _persistSession(result.tokens, result.user);
      return result.user;
    } catch (error) {
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
