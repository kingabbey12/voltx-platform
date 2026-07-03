import '../constants/auth_constants.dart';
import '../models/auth_user.dart';
import 'auth_repository.dart';

/// In-memory auth repository for UI development and testing.
class MockAuthRepository implements AuthRepository {
  AuthUser? _currentUser;

  @override
  AuthUser? get currentUser => _currentUser;

  @override
  Future<AuthUser> signIn({
    required String email,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 1200));

    final normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail == AuthMockCredentials.demoEmail &&
        password == AuthMockCredentials.demoPassword) {
      _currentUser = const AuthUser(
        id: 'mock-user-1',
        email: AuthMockCredentials.demoEmail,
        firstName: 'Demo',
        lastName: 'User',
        emailVerified: true,
      );
      return _currentUser!;
    }

    throw const AuthException(
      'Invalid email or password. Try demo@voltx.io / Password1!',
      code: 'invalid_credentials',
    );
  }

  @override
  Future<AuthUser> signUp({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 1400));

    if (email.trim().toLowerCase() == AuthMockCredentials.demoEmail) {
      throw const AuthException(
        'An account with this email already exists.',
        code: 'email_exists',
      );
    }

    _currentUser = AuthUser(
      id: 'mock-user-new',
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      emailVerified: false,
    );
    return _currentUser!;
  }

  @override
  Future<void> forgotPassword({required String email}) async {
    await Future<void>.delayed(const Duration(milliseconds: 1000));

    if (email.trim().isEmpty) {
      throw const AuthException('Email is required.');
    }
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 1100));

    if (token.trim().isEmpty) {
      throw const AuthException('Reset token is missing or invalid.');
    }

    if (token.trim() != AuthMockCredentials.validResetToken) {
      throw const AuthException(
        'This reset link has expired. Request a new one.',
        code: 'invalid_token',
      );
    }
  }

  @override
  Future<void> verifyEmail({required String token}) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));

    if (token.trim().length < 6) {
      throw const AuthException('Verification code must be at least 6 characters.');
    }

    if (_currentUser != null) {
      _currentUser = AuthUser(
        id: _currentUser!.id,
        email: _currentUser!.email,
        firstName: _currentUser!.firstName,
        lastName: _currentUser!.lastName,
        emailVerified: true,
      );
    }
  }

  @override
  Future<void> signOut() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    _currentUser = null;
  }
}
