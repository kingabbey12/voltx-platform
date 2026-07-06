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
  static const String myOrganizations = '/auth/my-organizations';
  static const String switchOrganization = '/auth/switch-organization';
}
