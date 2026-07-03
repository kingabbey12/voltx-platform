/// Central route path definitions for GoRouter.
abstract final class AppRoutes {
  static const String splash = '/';
  static const String welcome = '/welcome';
  static const String signIn = '/auth/sign-in';
  static const String signUp = '/auth/sign-up';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String verifyEmail = '/auth/verify-email';
  static const String home = '/home';
  static const String dashboard = '/dashboard';
  static const String dashboardAi = '/dashboard/ai';
  static const String dashboardNotifications = '/dashboard/notifications';
  static const String dashboardSearch = '/dashboard/search';
  static const String dashboardProfile = '/dashboard/profile';
  static const String settings = '/settings';
  static const String components = '/components';
  static const String loading = '/components/loading';
  static const String error = '/components/error';
  static const String empty = '/components/empty';

  static const Set<String> publicAuthRoutes = {
    splash,
    welcome,
    signIn,
    signUp,
    forgotPassword,
    resetPassword,
    verifyEmail,
  };

  static const Set<String> protectedRoutes = {
    home,
    dashboard,
    dashboardAi,
    dashboardNotifications,
    dashboardSearch,
    dashboardProfile,
    settings,
    components,
  };

  static bool isPublicAuthRoute(String location) {
    return publicAuthRoutes.contains(location) ||
        location.startsWith('$resetPassword?') ||
        location.startsWith('$verifyEmail?');
  }

  static bool isProtectedRoute(String location) {
    return protectedRoutes.any(
      (route) => location == route || location.startsWith('$route/'),
    );
  }
}
