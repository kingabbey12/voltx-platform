import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/presentation/providers/auth_providers.dart';
import '../features/auth/presentation/screens/auth_splash_screen.dart';
import '../features/auth/presentation/screens/forgot_password_screen.dart';
import '../features/auth/presentation/screens/reset_password_screen.dart';
import '../features/auth/presentation/screens/sign_in_screen.dart';
import '../features/auth/presentation/screens/sign_up_screen.dart';
import '../features/auth/presentation/screens/verify_email_screen.dart';
import '../features/auth/presentation/screens/welcome_screen.dart';
import '../features/auth/presentation/widgets/auth_page_transition.dart';
import '../features/ai/presentation/screens/ai_agents_screen.dart';
import '../features/ai/presentation/screens/ai_automations_screen.dart';
import '../features/ai/presentation/screens/ai_chat_screen.dart';
import '../features/ai/presentation/screens/ai_history_screen.dart';
import '../features/ai/presentation/screens/ai_home_screen.dart';
import '../features/ai/presentation/screens/ai_knowledge_screen.dart';
import '../features/integrations/presentation/screens/integrations_screen.dart';
import '../features/organizations/presentation/screens/accept_invitation_screen.dart';
import '../features/organizations/presentation/screens/invite_teammate_screen.dart';
import '../features/dashboard/presentation/screens/executive_dashboard_screen.dart';
import '../features/dashboard/presentation/screens/notifications_screen.dart';
import '../features/dashboard/presentation/screens/profile_screen.dart';
import '../features/dashboard/presentation/screens/search_screen.dart';
import '../features/dashboard/presentation/shell/dashboard_shell.dart';
import '../features/sales/presentation/screens/company_details_screen.dart';
import '../features/sales/presentation/screens/contact_details_screen.dart';
import '../features/sales/presentation/screens/lead_details_screen.dart';
import '../features/sales/presentation/screens/lead_pipeline_screen.dart';
import '../features/sales/presentation/screens/opportunity_board_screen.dart';
import '../features/sales/presentation/screens/sales_copilot_panel_screen.dart';
import '../features/sales/presentation/screens/sales_dashboard_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import 'routes.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

final routerProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = ValueNotifier<int>(0);

  ref.listen(authSessionProvider, (previous, next) {
    refreshNotifier.value++;
  });

  ref.onDispose(refreshNotifier.dispose);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: false,
    refreshListenable: refreshNotifier,
    redirect: (context, state) {
      // On a cold start, iOS/Android deliver a `voltx://...` launch URL to
      // the platform navigation channel before DeepLinkService's own
      // app_links listener gets a chance to translate it — go_router tries
      // to match that raw external URI as if it were an in-app path and
      // throws GoException("no routes for location: voltx://..."). Rewrite
      // it to the real in-app route here, at the earliest point go_router
      // gives us a hook, rather than relying solely on DeepLinkService
      // (which still handles the case where the app is already running).
      if (state.uri.scheme == 'voltx') {
        if (state.uri.host == 'invitations' && state.uri.path.startsWith('/accept')) {
          final token = state.uri.queryParameters['token'];
          return token != null
              ? '${AppRoutes.acceptInvitation}?token=${Uri.encodeQueryComponent(token)}'
              : AppRoutes.acceptInvitation;
        }
        return AppRoutes.splash;
      }

      final session = ref.read(authSessionProvider);
      final location = state.matchedLocation;

      if (AppRoutes.isProtectedRoute(location) && session == null) {
        return AppRoutes.welcome;
      }

      if (session != null &&
          (location == AppRoutes.welcome ||
              location == AppRoutes.signIn ||
              location == AppRoutes.signUp ||
              location == AppRoutes.verifyEmail ||
              location == AppRoutes.forgotPassword ||
              location == AppRoutes.resetPassword)) {
        return AppRoutes.dashboard;
      }

      if (location == AppRoutes.home) {
        return AppRoutes.dashboard;
      }

      if (location == AppRoutes.dashboardAi) {
        return AppRoutes.aiChat;
      }

      return null;
    },
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        name: 'splash',
        builder: (context, state) => const AuthSplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.welcome,
        name: 'welcome',
        pageBuilder: (context, state) => authTransitionPage(
          state: state,
          child: const WelcomeScreen(),
        ),
      ),
      GoRoute(
        path: AppRoutes.signIn,
        name: 'signIn',
        pageBuilder: (context, state) => authTransitionPage(
          state: state,
          child: const SignInScreen(),
        ),
      ),
      GoRoute(
        path: AppRoutes.signUp,
        name: 'signUp',
        pageBuilder: (context, state) => authTransitionPage(
          state: state,
          child: const SignUpScreen(),
        ),
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: 'forgotPassword',
        pageBuilder: (context, state) => authTransitionPage(
          state: state,
          child: const ForgotPasswordScreen(),
        ),
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        name: 'resetPassword',
        pageBuilder: (context, state) {
          final token = state.uri.queryParameters['token'];
          return authTransitionPage(
            state: state,
            child: ResetPasswordScreen(token: token),
          );
        },
      ),
      GoRoute(
        path: AppRoutes.verifyEmail,
        name: 'verifyEmail',
        pageBuilder: (context, state) {
          final token = state.uri.queryParameters['token'];
          return authTransitionPage(
            state: state,
            child: VerifyEmailScreen(token: token),
          );
        },
      ),
      GoRoute(
        path: AppRoutes.acceptInvitation,
        name: 'acceptInvitation',
        builder: (context, state) {
          final token = state.uri.queryParameters['token'];
          return AcceptInvitationScreen(token: token);
        },
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => DashboardShell(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.dashboard,
            name: 'dashboard',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ExecutiveDashboardScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.dashboardNotifications,
            name: 'dashboardNotifications',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: NotificationsScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.dashboardSearch,
            name: 'dashboardSearch',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SearchScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.dashboardProfile,
            name: 'dashboardProfile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfileScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.aiHome,
            name: 'aiHome',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AiHomeScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.aiChat,
            name: 'aiChat',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AiChatScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.aiAgents,
            name: 'aiAgents',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AiAgentsScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.aiKnowledge,
            name: 'aiKnowledge',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AiKnowledgeScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.aiAutomations,
            name: 'aiAutomations',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AiAutomationsScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.aiIntegrations,
            name: 'aiIntegrations',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: IntegrationsScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.aiHistory,
            name: 'aiHistory',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: AiHistoryScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.salesDashboard,
            name: 'salesDashboard',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SalesDashboardScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.salesPipeline,
            name: 'salesPipeline',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: LeadPipelineScreen(),
            ),
          ),
          GoRoute(
            path: '${AppRoutes.salesPipeline}/:id',
            name: 'salesLeadDetails',
            pageBuilder: (context, state) => NoTransitionPage(
              child: LeadDetailsScreen(leadId: state.pathParameters['id']!),
            ),
          ),
          GoRoute(
            path: '${AppRoutes.salesCompanies}/:id',
            name: 'salesCompanyDetails',
            pageBuilder: (context, state) => NoTransitionPage(
              child: CompanyDetailsScreen(companyId: state.pathParameters['id']!),
            ),
          ),
          GoRoute(
            path: '${AppRoutes.salesContacts}/:id',
            name: 'salesContactDetails',
            pageBuilder: (context, state) => NoTransitionPage(
              child: ContactDetailsScreen(contactId: state.pathParameters['id']!),
            ),
          ),
          GoRoute(
            path: AppRoutes.salesOpportunityBoard,
            name: 'salesOpportunityBoard',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: OpportunityBoardScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.salesCopilot,
            name: 'salesCopilot',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SalesCopilotPanelScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.settings,
            name: 'settings',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SettingsScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.manageTeam,
            name: 'manageTeam',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: InviteTeammateScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});
