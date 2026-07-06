import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/auth/utils/auth_validators.dart';

void main() {
  group('AuthValidators', () {
    test('email rejects invalid addresses', () {
      expect(AuthValidators.email(null), 'Email is required');
      expect(AuthValidators.email(''), 'Email is required');
      expect(
        AuthValidators.email('not-an-email'),
        'Enter a valid email address',
      );
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
}
