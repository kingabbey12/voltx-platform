/// Central route path definitions for GoRouter.
abstract final class AppRoutes {
  static const String splash = '/';
  static const String welcome = '/welcome';
  static const String signIn = '/auth/sign-in';
  static const String signUp = '/auth/sign-up';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String verifyEmail = '/auth/verify-email';
  static const String onboarding = '/onboarding';
  static const String home = '/home';
  static const String dashboard = '/dashboard';
  static const String dashboardAi = '/dashboard/ai';
  static const String dashboardNotifications = '/dashboard/notifications';
  static const String dashboardSearch = '/dashboard/search';
  static const String dashboardProfile = '/dashboard/profile';
  static const String aiHome = '/ai';
  static const String aiChat = '/ai/chat';
  static const String aiAgents = '/ai/agents';
  static const String aiKnowledge = '/ai/knowledge';
  static const String aiAutomations = '/ai/automations';
  static const String aiWorkflowApprovals = '/ai/automations/approvals';
  static const String aiIntegrations = '/ai/integrations';
  static const String aiHistory = '/ai/history';
  static const String aiOperator = '/ai/operator';
  static const String aiMemory = '/ai/memory';
  static const String salesDashboard = '/sales';
  static const String salesPipeline = '/sales/leads';
  static const String salesCompanies = '/sales/companies';
  static const String salesContacts = '/sales/contacts';
  static const String salesOpportunityBoard = '/sales/opportunities';
  static const String salesCopilot = '/sales/copilot';
  static const String billingHome = '/billing';
  static const String billingUpgrade = '/billing/upgrade';
  static const String billingInvoices = '/billing/invoices';
  static const String billingPaymentMethods = '/billing/payment-methods';
  static const String securityHome = '/security';
  static const String securitySessions = '/security/sessions';
  static const String securityDevices = '/security/devices';
  static const String securityMfa = '/security/mfa';
  static const String securityApiKeys = '/security/api-keys';
  static const String securityLoginHistory = '/security/login-history';
  static const String marketplaceHome = '/marketplace';
  static const String marketplaceInstalled = '/marketplace/installed';
  static const String marketplaceMyApps = '/marketplace/apps';
  static const String marketplacePayouts = '/marketplace/payouts';
  static const String settings = '/settings';
  static const String manageTeam = '/settings/team';
  static const String acceptInvitation = '/invitations/accept';
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
    onboarding,
    home,
    dashboard,
    dashboardAi,
    dashboardNotifications,
    dashboardSearch,
    dashboardProfile,
    aiHome,
    aiChat,
    aiAgents,
    aiKnowledge,
    aiAutomations,
    aiWorkflowApprovals,
    aiIntegrations,
    aiHistory,
    aiOperator,
    aiMemory,
    salesDashboard,
    salesPipeline,
    salesCompanies,
    salesContacts,
    salesOpportunityBoard,
    salesCopilot,
    billingHome,
    billingUpgrade,
    billingInvoices,
    billingPaymentMethods,
    securityHome,
    securitySessions,
    securityDevices,
    securityMfa,
    securityApiKeys,
    securityLoginHistory,
    marketplaceHome,
    marketplaceInstalled,
    marketplaceMyApps,
    marketplacePayouts,
    settings,
    manageTeam,
    components,
  };

  static String marketplaceAppDetails(String id) => '$marketplaceHome/$id';

  static String marketplaceMyAppDetails(String id) => '$marketplaceMyApps/$id';

  static String salesLeadDetails(String id) => '$salesPipeline/$id';

  static String salesCompanyDetails(String id) => '$salesCompanies/$id';

  static String salesContactDetails(String id) => '$salesContacts/$id';

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
