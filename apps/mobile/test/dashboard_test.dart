import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/dashboard/data/mock/mock_dashboard_data.dart';
import 'package:voltx_mobile/features/dashboard/presentation/providers/dashboard_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

void main() {
  group('Dashboard mock data', () {
    test('kpis has four metrics', () {
      expect(MockDashboardData.kpis.length, 4);
    });

    test('search results are searchable', () {
      expect(MockDashboardData.searchResults.length, greaterThan(0));
    });
  });

  group('Dashboard providers', () {
    test('search filters results by query', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(dashboardSearchProvider.notifier).setQuery('Helios');
      final results = container.read(dashboardSearchResultsProvider);
      expect(results.any((r) => r.title.contains('Helios')), isTrue);
    });

    test('notifications mark read reduces unread', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(dashboardNotificationsProvider.notifier);
      final firstId = MockDashboardData.notifications.first.id;
      notifier.markRead(firstId);
      final notifications = container.read(dashboardNotificationsProvider);
      expect(notifications.firstWhere((n) => n.id == firstId).read, isTrue);
    });

    test('shell toggles sidebar and ai panel', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(dashboardShellProvider.notifier);
      expect(container.read(dashboardShellProvider).sidebarCollapsed, isFalse);
      notifier.toggleSidebar();
      expect(container.read(dashboardShellProvider).sidebarCollapsed, isTrue);
      notifier.toggleAiPanel();
      expect(container.read(dashboardShellProvider).aiPanelOpen, isFalse);
    });

    test('ai chat appends messages on send', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final initial = container.read(aiChatMessagesProvider).length;
      container.read(aiChatMessagesProvider.notifier).sendMessage('Hello');
      final updated = container.read(aiChatMessagesProvider);
      expect(updated.length, initial + 2);
    });
  });
}
