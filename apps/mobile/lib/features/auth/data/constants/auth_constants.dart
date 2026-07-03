/// Auth API route paths — prepared for backend integration.
abstract final class AuthApiPaths {
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String forgotPassword = '/auth/request-password-reset';
  static const String resetPassword = '/auth/reset-password';
  static const String verifyEmail = '/auth/verify-email';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';
}

/// Demo credentials accepted by the mock repository.
abstract final class AuthMockCredentials {
  static const String demoEmail = 'demo@voltx.io';
  static const String demoPassword = 'Password1!';
  static const String validResetToken = 'valid-reset-token';
  static const String validVerifyToken = 'valid-verify-token';
}
