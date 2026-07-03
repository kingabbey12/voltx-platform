import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

  DashboardShellState copyWith({
    bool? sidebarCollapsed,
    bool? aiPanelOpen,
  }) {
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

final dashboardKpisProvider = Provider<List<DashboardKpi>>(
  (ref) => MockDashboardData.kpis,
);

final dashboardActivitiesProvider = Provider<List<DashboardActivity>>(
  (ref) => MockDashboardData.activities,
);

final dashboardInsightsProvider = Provider<List<DashboardInsight>>(
  (ref) => MockDashboardData.insights,
);

final dashboardProjectsProvider = Provider<List<DashboardProject>>(
  (ref) => MockDashboardData.projects,
);

final dashboardNotificationsProvider =
    StateNotifierProvider<DashboardNotificationsNotifier, List<DashboardNotification>>(
  (ref) => DashboardNotificationsNotifier(),
);

class DashboardNotificationsNotifier
    extends StateNotifier<List<DashboardNotification>> {
  DashboardNotificationsNotifier()
      : super(List.of(MockDashboardData.notifications));

  int get unreadCount => state.where((n) => !n.read).length;

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

final dashboardSearchResultsProvider = Provider<List<DashboardSearchResult>>((ref) {
  final query = ref.watch(dashboardSearchProvider).trim().toLowerCase();
  if (query.isEmpty) {
    return MockDashboardData.searchResults;
  }
  return MockDashboardData.searchResults.where((result) {
    return result.title.toLowerCase().contains(query) ||
        result.subtitle.toLowerCase().contains(query) ||
        result.category.toLowerCase().contains(query);
  }).toList();
});

final commandPaletteOpenProvider = StateProvider<bool>((ref) => false);

final commandPaletteQueryProvider = StateProvider<String>((ref) => '');

final commandPaletteResultsProvider = Provider<List<CommandPaletteItem>>((ref) {
  final query = ref.watch(commandPaletteQueryProvider).trim().toLowerCase();
  final items = MockDashboardData.commandPaletteItems;
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
  (ref) => AiChatMessagesNotifier(),
);

class AiChatMessagesNotifier extends StateNotifier<List<AiChatMessage>> {
  AiChatMessagesNotifier() : super(List.of(MockDashboardData.aiMessages));

  void sendMessage(String content) {
    if (content.trim().isEmpty) {
      return;
    }
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
            'I analyzed your request. Based on current grid data, I recommend reviewing the North Region load profile and scheduling a maintenance window for Turbine Cluster B.',
        isUser: false,
        timestamp: now.add(const Duration(seconds: 1)),
      ),
    ];
  }
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
