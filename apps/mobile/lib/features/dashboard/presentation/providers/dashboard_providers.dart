import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../ai/data/models/ai_models.dart';
import '../../../ai/data/services/ai_api_service.dart';
import '../../../ai/presentation/providers/ai_providers.dart';
import '../../../sales/data/models/sales_models.dart';
import '../../../sales/presentation/providers/sales_providers.dart';
import '../../data/mock/mock_dashboard_data.dart';
import '../../data/models/dashboard_models.dart';

/// Shell layout state for the executive dashboard.
class DashboardShellState {
  const DashboardShellState({
    this.sidebarCollapsed = false,
    this.aiPanelOpen = true,
  });

  final bool sidebarCollapsed;
  final bool aiPanelOpen;

  DashboardShellState copyWith({bool? sidebarCollapsed, bool? aiPanelOpen}) {
    return DashboardShellState(
      sidebarCollapsed: sidebarCollapsed ?? this.sidebarCollapsed,
      aiPanelOpen: aiPanelOpen ?? this.aiPanelOpen,
    );
  }
}

class DashboardShellNotifier extends StateNotifier<DashboardShellState> {
  DashboardShellNotifier() : super(const DashboardShellState());

  void toggleSidebar() {
    state = state.copyWith(sidebarCollapsed: !state.sidebarCollapsed);
  }

  void toggleAiPanel() {
    state = state.copyWith(aiPanelOpen: !state.aiPanelOpen);
  }

  void setAiPanelOpen(bool open) {
    state = state.copyWith(aiPanelOpen: open);
  }
}

final dashboardShellProvider =
    StateNotifierProvider<DashboardShellNotifier, DashboardShellState>(
      (ref) => DashboardShellNotifier(),
    );

const _dashboardQuery = SalesPageQuery(page: 1, limit: 50);

bool _hasFlutterBinding() {
  try {
    WidgetsBinding.instance;
    return true;
  } catch (_) {
    return false;
  }
}

final _dashboardLeadsProvider = FutureProvider<PaginatedSalesResult<SalesLead>>(
  (ref) {
    return ref.watch(salesRepositoryProvider).listLeads(_dashboardQuery);
  },
);

final _dashboardContactsProvider =
    FutureProvider<PaginatedSalesResult<SalesContact>>((ref) {
      return ref.watch(salesRepositoryProvider).listContacts(_dashboardQuery);
    });

final _dashboardOpportunitiesProvider =
    FutureProvider<PaginatedSalesResult<SalesOpportunity>>((ref) {
      return ref
          .watch(salesRepositoryProvider)
          .listOpportunities(_dashboardQuery);
    });

final _dashboardActivitiesProvider =
    FutureProvider<PaginatedSalesResult<SalesActivity>>((ref) {
      return ref.watch(salesRepositoryProvider).listActivities(_dashboardQuery);
    });

final _dashboardCompaniesProvider =
    FutureProvider<PaginatedSalesResult<SalesCompany>>((ref) {
      return ref.watch(salesRepositoryProvider).listCompanies(_dashboardQuery);
    });

final _dashboardConversationsProvider = FutureProvider<List<AiConversation>>((
  ref,
) {
  return ref.watch(aiApiServiceProvider).listConversations(limit: 20);
});

final _dashboardMemoriesProvider = FutureProvider<List<AiMemory>>((ref) {
  return ref.watch(aiApiServiceProvider).listMemories(limit: 50);
});

/// Pull-to-refresh entry point for the executive dashboard — invalidates
/// every underlying live data source the derived `dashboard*Provider`s
/// (KPIs, activity feed, insights, projects, notifications, search) are
/// computed from. Exposed as a plain function (rather than a public
/// provider) since the underlying FutureProviders are intentionally
/// private — screens should never watch sales/AI data directly, only the
/// dashboard-shaped views derived from it.
void refreshDashboardData(WidgetRef ref) {
  ref.invalidate(_dashboardLeadsProvider);
  ref.invalidate(_dashboardContactsProvider);
  ref.invalidate(_dashboardOpportunitiesProvider);
  ref.invalidate(_dashboardActivitiesProvider);
  ref.invalidate(_dashboardCompaniesProvider);
  ref.invalidate(_dashboardConversationsProvider);
  ref.invalidate(_dashboardMemoriesProvider);
}

final dashboardKpisProvider = Provider<List<DashboardKpi>>((ref) {
  if (!_hasFlutterBinding()) {
    return MockDashboardData.kpis;
  }

  final opportunities =
      ref.watch(_dashboardOpportunitiesProvider).valueOrNull?.items ?? const [];
  final leads =
      ref.watch(_dashboardLeadsProvider).valueOrNull?.items ?? const [];
  final contacts =
      ref.watch(_dashboardContactsProvider).valueOrNull?.items ?? const [];
  final activities =
      ref.watch(_dashboardActivitiesProvider).valueOrNull?.items ?? const [];

  final totalRevenue = opportunities.fold<double>(
    0,
    (sum, item) => sum + (item.amount ?? 0),
  );
  final avgProbability = opportunities.isEmpty
      ? 0
      : (opportunities.fold<int>(0, (sum, item) => sum + item.probability) /
                opportunities.length)
            .round();
  final wonDeals = opportunities
      .where((item) => item.stage.toUpperCase().contains('WON'))
      .length;
  final completionRate = activities.isEmpty
      ? 0
      : ((activities.where((item) => item.completed).length /
                    activities.length) *
                100)
            .round();

  return [
    DashboardKpi(
      id: 'kpi-revenue',
      label: 'Revenue',
      value: _formatCurrencyCompact(totalRevenue),
      delta: '$wonDeals won deals',
      trend: wonDeals > 0 ? KpiTrend.up : KpiTrend.neutral,
      iconName: 'payments',
    ),
    DashboardKpi(
      id: 'kpi-pipeline',
      label: 'Pipeline',
      value: '${opportunities.length}',
      delta: '$avgProbability% avg probability',
      trend: avgProbability >= 50 ? KpiTrend.up : KpiTrend.neutral,
      iconName: 'dashboard',
    ),
    DashboardKpi(
      id: 'kpi-leads',
      label: 'Leads',
      value: '${leads.length}',
      delta:
          '${leads.where((item) => item.status.toUpperCase() == 'NEW').length} new',
      trend: leads.isNotEmpty ? KpiTrend.up : KpiTrend.neutral,
      iconName: 'location',
    ),
    DashboardKpi(
      id: 'kpi-activities',
      label: 'Activities',
      value: '${activities.length}',
      delta: '$completionRate% complete',
      trend: completionRate >= 50 ? KpiTrend.up : KpiTrend.down,
      iconName: 'speed',
    ),
    DashboardKpi(
      id: 'kpi-contacts',
      label: 'Contacts',
      value: '${contacts.length}',
      delta:
          '${contacts.where((item) => (item.email ?? '').isNotEmpty).length} reachable',
      trend: contacts.isNotEmpty ? KpiTrend.up : KpiTrend.neutral,
      iconName: 'person',
    ),
    DashboardKpi(
      id: 'kpi-ai',
      label: 'AI Context',
      value:
          '${ref.watch(_dashboardMemoriesProvider).valueOrNull?.length ?? 0}',
      delta:
          '${ref.watch(_dashboardConversationsProvider).valueOrNull?.length ?? 0} conversations',
      trend: KpiTrend.neutral,
      iconName: 'ai',
    ),
  ];
});

final dashboardActivitiesProvider = Provider<List<DashboardActivity>>((ref) {
  if (!_hasFlutterBinding()) {
    return MockDashboardData.activities;
  }

  final activities =
      ref.watch(_dashboardActivitiesProvider).valueOrNull?.items ?? const [];
  final sorted = List<SalesActivity>.from(activities)
    ..sort((a, b) => _bestActivityTime(b).compareTo(_bestActivityTime(a)));

  return sorted.take(24).map((item) {
    return DashboardActivity(
      id: item.id,
      title: item.subject,
      subtitle: '${item.type}${item.completed ? ' · completed' : ' · pending'}',
      timestamp: _bestActivityTime(item),
      type: _mapActivityType(item),
    );
  }).toList();
});

final dashboardInsightsProvider = Provider<List<DashboardInsight>>((ref) {
  if (!_hasFlutterBinding()) {
    return MockDashboardData.insights;
  }

  final opportunities =
      ref.watch(_dashboardOpportunitiesProvider).valueOrNull?.items ?? const [];
  final leads =
      ref.watch(_dashboardLeadsProvider).valueOrNull?.items ?? const [];
  final insights = <DashboardInsight>[];

  for (final opportunity in opportunities) {
    final text = (opportunity.insights ?? opportunity.nextBestAction ?? '')
        .trim();
    if (text.isEmpty) {
      continue;
    }
    insights.add(
      DashboardInsight(
        id: 'opp-${opportunity.id}',
        title: opportunity.title,
        summary: text,
        confidence: opportunity.probability.clamp(0, 100),
        actionLabel: 'Review opportunity',
      ),
    );
  }

  for (final lead in leads) {
    final summary = (lead.qualificationSummary ?? '').trim();
    if (summary.isEmpty) {
      continue;
    }
    insights.add(
      DashboardInsight(
        id: 'lead-${lead.id}',
        title: lead.title,
        summary: summary,
        confidence: (lead.qualificationScore ?? 50).clamp(0, 100),
        actionLabel: 'Open lead',
      ),
    );
  }

  return insights.take(10).toList();
});

final dashboardProjectsProvider = Provider<List<DashboardProject>>((ref) {
  if (!_hasFlutterBinding()) {
    return MockDashboardData.projects;
  }

  final companies =
      ref.watch(_dashboardCompaniesProvider).valueOrNull?.items ?? const [];
  final opportunities =
      ref.watch(_dashboardOpportunitiesProvider).valueOrNull?.items ?? const [];

  return companies.take(8).map((company) {
    final related = opportunities
        .where((item) => item.companyId == company.id)
        .toList();
    final progress = related.isEmpty
        ? 0.0
        : related.fold<int>(0, (sum, item) => sum + item.probability) /
              (related.length * 100);
    final atRisk = related.any(
      (item) => item.stage.toUpperCase().contains('RISK'),
    );
    return DashboardProject(
      id: company.id,
      name: company.name,
      status: atRisk ? 'At risk' : 'On track',
      progress: progress.clamp(0.0, 1.0),
      owner: company.industry?.trim().isNotEmpty == true
          ? company.industry!
          : 'Sales Team',
    );
  }).toList();
});

final dashboardRevenueSeriesProvider = Provider<List<double>>((ref) {
  if (!_hasFlutterBinding()) {
    return const [0.24, 0.34, 0.45, 0.57, 0.63, 0.76, 0.9];
  }

  final opportunities =
      ref.watch(_dashboardOpportunitiesProvider).valueOrNull?.items ?? const [];
  final amounts =
      opportunities
          .map((item) => item.amount ?? 0)
          .where((amount) => amount > 0)
          .toList()
        ..sort();
  return _normalizeSeries(amounts, fallbackLength: 7);
});

final dashboardPipelineSeriesProvider = Provider<List<double>>((ref) {
  if (!_hasFlutterBinding()) {
    return const [0.22, 0.34, 0.38, 0.46, 0.6, 0.68, 0.8];
  }

  final leads =
      ref.watch(_dashboardLeadsProvider).valueOrNull?.items ?? const [];
  final scores =
      leads
          .map((item) => (item.qualificationScore ?? 0).toDouble())
          .where((score) => score > 0)
          .toList()
        ..sort();
  return _normalizeSeries(scores, fallbackLength: 7);
});

final dashboardForecastSeriesProvider = Provider<List<double>>((ref) {
  if (!_hasFlutterBinding()) {
    return const [0.5, 0.56, 0.6, 0.63, 0.66, 0.71, 0.76];
  }

  final opportunities =
      ref.watch(_dashboardOpportunitiesProvider).valueOrNull?.items ?? const [];
  final probabilities =
      opportunities
          .map((item) => item.probability.toDouble())
          .where((score) => score > 0)
          .toList()
        ..sort();
  return _normalizeSeries(probabilities, fallbackLength: 7);
});

final _dashboardNotificationsSourceProvider =
    Provider<List<DashboardNotification>>((ref) {
      if (!_hasFlutterBinding()) {
        return MockDashboardData.notifications;
      }

      final activities = ref.watch(dashboardActivitiesProvider);
      final opportunities =
          ref.watch(_dashboardOpportunitiesProvider).valueOrNull?.items ??
          const [];
      final leads =
          ref.watch(_dashboardLeadsProvider).valueOrNull?.items ?? const [];

      final activityNotifications = activities.take(12).map((item) {
        return DashboardNotification(
          id: 'act-${item.id}',
          title: item.title,
          body: item.subtitle,
          timestamp: item.timestamp,
          read: false,
          category: 'Activity',
        );
      });

      final opportunityNotifications = opportunities
          .where((item) => item.stage.toUpperCase().contains('RISK'))
          .take(6)
          .map(
            (item) => DashboardNotification(
              id: 'opp-${item.id}',
              title: 'Opportunity at risk',
              body: item.title,
              timestamp: _parseDate(item.updatedAt) ?? DateTime.now(),
              read: false,
              category: 'Pipeline',
            ),
          );

      final leadNotifications = leads
          .where((item) => item.status.toUpperCase() == 'NEW')
          .take(6)
          .map(
            (item) => DashboardNotification(
              id: 'lead-${item.id}',
              title: 'New lead',
              body: item.title,
              timestamp: _parseDate(item.createdAt) ?? DateTime.now(),
              read: false,
              category: 'Leads',
            ),
          );

      final combined = [
        ...activityNotifications,
        ...opportunityNotifications,
        ...leadNotifications,
      ]..sort((a, b) => b.timestamp.compareTo(a.timestamp));
      return combined.take(20).toList();
    });

final dashboardNotificationsProvider =
    StateNotifierProvider<
      DashboardNotificationsNotifier,
      List<DashboardNotification>
    >((ref) {
      if (!_hasFlutterBinding()) {
        return DashboardNotificationsNotifier(MockDashboardData.notifications);
      }

      final notifier = DashboardNotificationsNotifier(
        ref.watch(_dashboardNotificationsSourceProvider),
      );
      ref.listen<List<DashboardNotification>>(
        _dashboardNotificationsSourceProvider,
        (_, next) {
          notifier.syncFromSource(next);
        },
      );
      return notifier;
    });

class DashboardNotificationsNotifier
    extends StateNotifier<List<DashboardNotification>> {
  DashboardNotificationsNotifier(List<DashboardNotification> source)
    : super(List.of(source));

  int get unreadCount => state.where((n) => !n.read).length;

  void syncFromSource(List<DashboardNotification> source) {
    final readMap = <String, bool>{
      for (final item in state) item.id: item.read,
    };
    state = [
      for (final item in source)
        DashboardNotification(
          id: item.id,
          title: item.title,
          body: item.body,
          timestamp: item.timestamp,
          read: readMap[item.id] ?? item.read,
          category: item.category,
        ),
    ];
  }

  void markRead(String id) {
    state = [
      for (final notification in state)
        if (notification.id == id)
          DashboardNotification(
            id: notification.id,
            title: notification.title,
            body: notification.body,
            timestamp: notification.timestamp,
            read: true,
            category: notification.category,
          )
        else
          notification,
    ];
  }

  void markAllRead() {
    state = [
      for (final notification in state)
        DashboardNotification(
          id: notification.id,
          title: notification.title,
          body: notification.body,
          timestamp: notification.timestamp,
          read: true,
          category: notification.category,
        ),
    ];
  }
}

final unreadNotificationsCountProvider = Provider<int>((ref) {
  final notifications = ref.watch(dashboardNotificationsProvider);
  return notifications.where((n) => !n.read).length;
});

final dashboardSearchProvider =
    StateNotifierProvider<DashboardSearchNotifier, String>(
      (ref) => DashboardSearchNotifier(),
    );

class DashboardSearchNotifier extends StateNotifier<String> {
  DashboardSearchNotifier() : super('');

  void setQuery(String query) => state = query;
  void clear() => state = '';
}

final dashboardSearchResultsProvider = Provider<List<DashboardSearchResult>>((
  ref,
) {
  final query = ref.watch(dashboardSearchProvider).trim().toLowerCase();
  if (!_hasFlutterBinding()) {
    if (query.isEmpty) {
      return MockDashboardData.searchResults;
    }
    return MockDashboardData.searchResults.where((result) {
      return result.title.toLowerCase().contains(query) ||
          result.subtitle.toLowerCase().contains(query) ||
          result.category.toLowerCase().contains(query);
    }).toList();
  }

  final companies =
      ref.watch(_dashboardCompaniesProvider).valueOrNull?.items ?? const [];
  final contacts =
      ref.watch(_dashboardContactsProvider).valueOrNull?.items ?? const [];
  final leads =
      ref.watch(_dashboardLeadsProvider).valueOrNull?.items ?? const [];
  final opportunities =
      ref.watch(_dashboardOpportunitiesProvider).valueOrNull?.items ?? const [];
  final activities = ref.watch(dashboardActivitiesProvider);

  final results = <DashboardSearchResult>[
    ...companies.map(
      (item) => DashboardSearchResult(
        id: 'company-${item.id}',
        title: item.name,
        subtitle: item.status,
        category: 'Companies',
        route: AppRoutes.salesContacts,
      ),
    ),
    ...contacts.map(
      (item) => DashboardSearchResult(
        id: 'contact-${item.id}',
        title: item.fullName,
        subtitle: item.jobTitle ?? 'Contact',
        category: 'Contacts',
        route: AppRoutes.salesContacts,
      ),
    ),
    ...leads.map(
      (item) => DashboardSearchResult(
        id: 'lead-${item.id}',
        title: item.title,
        subtitle: item.status,
        category: 'Leads',
        route: AppRoutes.salesPipeline,
      ),
    ),
    ...opportunities.map(
      (item) => DashboardSearchResult(
        id: 'opp-${item.id}',
        title: item.title,
        subtitle: item.stage,
        category: 'Opportunities',
        route: AppRoutes.salesOpportunityBoard,
      ),
    ),
    ...activities.map(
      (item) => DashboardSearchResult(
        id: 'activity-${item.id}',
        title: item.title,
        subtitle: item.subtitle,
        category: 'Activities',
        route: AppRoutes.dashboard,
      ),
    ),
  ];

  if (query.isEmpty) {
    return results.take(20).toList();
  }
  return results
      .where((result) {
        return result.title.toLowerCase().contains(query) ||
            result.subtitle.toLowerCase().contains(query) ||
            result.category.toLowerCase().contains(query);
      })
      .take(20)
      .toList();
});

final commandPaletteOpenProvider = StateProvider<bool>((ref) => false);

final commandPaletteQueryProvider = StateProvider<String>((ref) => '');

final commandPaletteResultsProvider = Provider<List<CommandPaletteItem>>((ref) {
  final query = ref.watch(commandPaletteQueryProvider).trim().toLowerCase();
  const items = [
    CommandPaletteItem(
      id: 'cmd-dashboard',
      label: 'Go to Dashboard',
      subtitle: 'Executive overview',
      iconName: 'dashboard',
      route: AppRoutes.dashboard,
      keywords: ['home', 'overview', 'executive'],
    ),
    CommandPaletteItem(
      id: 'cmd-ai',
      label: 'Open AI Workspace',
      subtitle: 'Chat with Voltx AI',
      iconName: 'ai',
      route: AppRoutes.aiChat,
      keywords: ['assistant', 'chat', 'ai'],
    ),
    CommandPaletteItem(
      id: 'cmd-notifications',
      label: 'View Notifications',
      subtitle: 'Alerts and updates',
      iconName: 'notifications',
      route: AppRoutes.dashboardNotifications,
      keywords: ['alerts', 'inbox'],
    ),
    CommandPaletteItem(
      id: 'cmd-search',
      label: 'Search',
      subtitle: 'Find projects and people',
      iconName: 'search',
      route: AppRoutes.dashboardSearch,
      keywords: ['find', 'lookup'],
    ),
    CommandPaletteItem(
      id: 'cmd-profile',
      label: 'Profile',
      subtitle: 'Account and preferences',
      iconName: 'person',
      route: AppRoutes.dashboardProfile,
      keywords: ['account', 'user'],
    ),
    CommandPaletteItem(
      id: 'cmd-settings',
      label: 'Settings',
      subtitle: 'Appearance and account',
      iconName: 'settings',
      route: AppRoutes.settings,
      keywords: ['preferences', 'theme'],
    ),
    CommandPaletteItem(
      id: 'cmd-toggle-ai',
      label: 'Toggle AI Panel',
      subtitle: 'Show or hide assistant',
      iconName: 'panel',
      route: '__toggle_ai__',
      keywords: ['sidebar', 'assistant'],
    ),
    CommandPaletteItem(
      id: 'cmd-toggle-sidebar',
      label: 'Toggle Sidebar',
      subtitle: 'Collapse navigation',
      iconName: 'sidebar',
      route: '__toggle_sidebar__',
      keywords: ['nav', 'menu'],
    ),
  ];

  if (query.isEmpty) {
    return items;
  }
  return items.where((item) {
    return item.label.toLowerCase().contains(query) ||
        item.subtitle.toLowerCase().contains(query) ||
        item.keywords.any((k) => k.contains(query));
  }).toList();
});

final aiChatMessagesProvider =
    StateNotifierProvider<AiChatMessagesNotifier, List<AiChatMessage>>(
      (ref) => AiChatMessagesNotifier(ref, ref.watch(aiApiServiceProvider)),
    );

class AiChatMessagesNotifier extends StateNotifier<List<AiChatMessage>> {
  AiChatMessagesNotifier(this._ref, this._api) : super(const []) {
    if (!_hasFlutterBinding()) {
      state = List.of(MockDashboardData.aiMessages);
      return;
    }
    unawaited(_load());
  }

  final Ref _ref;
  final AiApiService _api;
  String _conversationId = '';

  Future<void> _load() async {
    try {
      final conversations = await _api.listConversations(limit: 1);
      if (conversations.isEmpty) {
        state = const [];
        return;
      }

      _conversationId = conversations.first.id;
      final messages = await _api.listMessages(_conversationId, limit: 16);
      if (!mounted) {
        return;
      }
      state = messages
          .map(
            (message) => AiChatMessage(
              id: message.id,
              content: message.displayContent,
              isUser: message.isUser,
              timestamp: message.timestamp,
            ),
          )
          .toList();
    } catch (_) {
      if (mounted) {
        state = const [];
      }
    }
  }

  Future<void> sendMessage(String content) async {
    if (content.trim().isEmpty) {
      return;
    }

    if (!_hasFlutterBinding()) {
      final now = DateTime.now();
      state = [
        ...state,
        AiChatMessage(
          id: 'user-${now.millisecondsSinceEpoch}',
          content: content.trim(),
          isUser: true,
          timestamp: now,
        ),
        AiChatMessage(
          id: 'ai-${now.millisecondsSinceEpoch}',
          content:
              'I analyzed your request. Based on current sales data, I recommend prioritizing high-probability opportunities and pending activities.',
          isUser: false,
          timestamp: now.add(const Duration(seconds: 1)),
        ),
      ];
      return;
    }

    if (_conversationId.trim().isEmpty) {
      final conversation = await _api.createConversation(title: 'Dashboard AI');
      _conversationId = conversation.id;
    }

    final now = DateTime.now();
    final userMessage = AiChatMessage(
      id: 'user-${now.millisecondsSinceEpoch}',
      content: content.trim(),
      isUser: true,
      timestamp: now,
    );
    state = [...state, userMessage];

    try {
      final response = await _api.createMessage(
        _conversationId,
        content: content.trim(),
      );
      if (!mounted) {
        return;
      }

      final liveMessages = <AiChatMessage>[...state];
      for (final item in response.toolMessages) {
        liveMessages.add(
          AiChatMessage(
            id: item.id,
            content: item.displayContent,
            isUser: false,
            timestamp: item.timestamp,
          ),
        );
      }
      if (response.assistantMessage != null) {
        final assistant = response.assistantMessage!;
        liveMessages.add(
          AiChatMessage(
            id: assistant.id,
            content: assistant.displayContent,
            isUser: false,
            timestamp: assistant.timestamp,
          ),
        );
      }
      state = liveMessages;
      _ref.invalidate(_dashboardConversationsProvider);
    } catch (_) {
      if (!mounted) {
        return;
      }
    }
  }
}

DateTime _bestActivityTime(SalesActivity item) {
  return _parseDate(item.occurredAt) ??
      _parseDate(item.dueAt) ??
      _parseDate(item.updatedAt) ??
      _parseDate(item.createdAt) ??
      DateTime.now();
}

ActivityType _mapActivityType(SalesActivity item) {
  final type = item.type.toLowerCase();
  if (!item.completed && (type.contains('task') || type.contains('call'))) {
    return ActivityType.alert;
  }
  if (item.completed) {
    return ActivityType.approval;
  }
  if (type.contains('meeting') || type.contains('note')) {
    return ActivityType.update;
  }
  return ActivityType.insight;
}

List<double> _normalizeSeries(
  List<double> values, {
  required int fallbackLength,
}) {
  if (values.isEmpty) {
    return List<double>.filled(fallbackLength, 0.0);
  }

  final sorted = List<double>.from(values)..sort();
  final take = sorted.length >= fallbackLength
      ? sorted.sublist(sorted.length - fallbackLength)
      : sorted;
  final max = take.fold<double>(
    0,
    (current, value) => value > current ? value : current,
  );
  if (max <= 0) {
    return List<double>.filled(fallbackLength, 0.0);
  }

  final normalized = take
      .map((value) => (value / max).clamp(0.0, 1.0))
      .toList();
  while (normalized.length < fallbackLength) {
    normalized.insert(0, normalized.isEmpty ? 0.0 : normalized.first);
  }
  return normalized;
}

DateTime? _parseDate(String? value) {
  if (value == null || value.trim().isEmpty) {
    return null;
  }
  return DateTime.tryParse(value);
}

String _formatCurrencyCompact(double value) {
  if (value >= 1000000000) {
    return '\$${(value / 1000000000).toStringAsFixed(1)}B';
  }
  if (value >= 1000000) {
    return '\$${(value / 1000000).toStringAsFixed(1)}M';
  }
  if (value >= 1000) {
    return '\$${(value / 1000).toStringAsFixed(1)}K';
  }
  return '\$${value.toStringAsFixed(0)}';
}

/// Maps icon name strings to Material icons.
IconData dashboardIcon(String name) {
  return switch (name) {
    'bolt' => Icons.bolt_rounded,
    'speed' => Icons.speed_rounded,
    'location' => Icons.location_on_outlined,
    'payments' => Icons.payments_outlined,
    'dashboard' => Icons.dashboard_outlined,
    'ai' => Icons.auto_awesome_rounded,
    'notifications' => Icons.notifications_outlined,
    'search' => Icons.search_rounded,
    'person' => Icons.person_outline_rounded,
    'settings' => Icons.settings_outlined,
    'panel' => Icons.view_sidebar_outlined,
    'sidebar' => Icons.menu_open_rounded,
    _ => Icons.circle_outlined,
  };
}
