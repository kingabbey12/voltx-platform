import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/auth/data/constants/auth_constants.dart';
import 'package:voltx_mobile/features/auth/data/models/auth_user.dart';
import 'package:voltx_mobile/features/auth/data/repositories/mock_auth_repository.dart';
import 'package:voltx_mobile/features/auth/utils/auth_validators.dart';

void main() {
  group('AuthValidators', () {
    test('email rejects invalid addresses', () {
      expect(AuthValidators.email(null), 'Email is required');
      expect(AuthValidators.email(''), 'Email is required');
      expect(AuthValidators.email('not-an-email'), 'Enter a valid email address');
      expect(AuthValidators.email('user@voltx.io'), isNull);
    });

    test('password enforces complexity', () {
      expect(AuthValidators.password('short'), isNotNull);
      expect(AuthValidators.password('password'), isNotNull);
      expect(AuthValidators.password('Password1!'), isNull);
    });

    test('confirmPassword matches password', () {
      expect(
        AuthValidators.confirmPassword('Password1!', 'Password1!'),
        isNull,
      );
      expect(
        AuthValidators.confirmPassword('Password2!', 'Password1!'),
        'Passwords do not match',
      );
    });

    test('verificationToken requires minimum length', () {
      expect(AuthValidators.verificationToken('12345'), isNotNull);
      expect(AuthValidators.verificationToken('123456'), isNull);
    });
  });

  group('MockAuthRepository', () {
    late MockAuthRepository repository;

    setUp(() {
      repository = MockAuthRepository();
    });

    test('signIn succeeds with demo credentials', () async {
      final user = await repository.signIn(
        email: AuthMockCredentials.demoEmail,
        password: AuthMockCredentials.demoPassword,
      );

      expect(user.email, AuthMockCredentials.demoEmail);
      expect(user.emailVerified, isTrue);
      expect(repository.currentUser, isNotNull);
    });

    test('signIn throws for invalid credentials', () async {
      expect(
        () => repository.signIn(email: 'wrong@voltx.io', password: 'bad'),
        throwsA(isA<AuthException>()),
      );
    });

    test('signUp creates unverified user', () async {
      final user = await repository.signUp(
        email: 'new@voltx.io',
        password: 'Password1!',
        firstName: 'New',
        lastName: 'User',
      );

      expect(user.emailVerified, isFalse);
      expect(user.displayName, 'New User');
    });

    test('resetPassword accepts valid token', () async {
      await expectLater(
        repository.resetPassword(
          token: AuthMockCredentials.validResetToken,
          password: 'Password1!',
        ),
        completes,
      );
    });

    test('resetPassword rejects invalid token', () async {
      expect(
        () => repository.resetPassword(token: 'bad-token', password: 'Password1!'),
        throwsA(isA<AuthException>()),
      );
    });

    test('verifyEmail accepts codes with 6+ characters', () async {
      await repository.signUp(
        email: 'verify@voltx.io',
        password: 'Password1!',
        firstName: 'Verify',
        lastName: 'User',
      );

      await expectLater(
        repository.verifyEmail(token: '123456'),
        completes,
      );
      expect(repository.currentUser?.emailVerified, isTrue);
    });

    test('signOut clears session', () async {
      await repository.signIn(
        email: AuthMockCredentials.demoEmail,
        password: AuthMockCredentials.demoPassword,
      );
      await repository.signOut();
      expect(repository.currentUser, isNull);
    });
  });
}
