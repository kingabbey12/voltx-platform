import '../models/dashboard_models.dart';

/// Mock dashboard data for UI development.
abstract final class MockDashboardData {
  static final DateTime _now = DateTime(2026, 7, 3, 9, 0);

  static const kpis = [
    DashboardKpi(
      id: 'kpi-1',
      label: 'Grid Output',
      value: '2.4 GW',
      delta: '+12.4%',
      trend: KpiTrend.up,
      iconName: 'bolt',
    ),
    DashboardKpi(
      id: 'kpi-2',
      label: 'Efficiency',
      value: '94.2%',
      delta: '+2.1%',
      trend: KpiTrend.up,
      iconName: 'speed',
    ),
    DashboardKpi(
      id: 'kpi-3',
      label: 'Active Sites',
      value: '128',
      delta: '+4',
      trend: KpiTrend.up,
      iconName: 'location',
    ),
    DashboardKpi(
      id: 'kpi-4',
      label: 'Cost Index',
      value: '\$0.082',
      delta: '-3.8%',
      trend: KpiTrend.down,
      iconName: 'payments',
    ),
  ];

  static final activities = [
    DashboardActivity(
      id: 'act-1',
      title: 'Peak demand alert resolved',
      subtitle: 'North Region · Automated load balancing applied',
      timestamp: _now.subtract(const Duration(minutes: 12)),
      type: ActivityType.alert,
    ),
    DashboardActivity(
      id: 'act-2',
      title: 'Solar farm expansion approved',
      subtitle: 'Project Helios · Phase 2 cleared by ops',
      timestamp: _now.subtract(const Duration(hours: 1)),
      type: ActivityType.approval,
    ),
    DashboardActivity(
      id: 'act-3',
      title: 'Weekly efficiency report ready',
      subtitle: 'Analytics · 6 sites exceeded targets',
      timestamp: _now.subtract(const Duration(hours: 3)),
      type: ActivityType.update,
    ),
    DashboardActivity(
      id: 'act-4',
      title: 'AI forecast updated',
      subtitle: 'Demand model · 96% confidence for Friday peak',
      timestamp: _now.subtract(const Duration(hours: 5)),
      type: ActivityType.insight,
    ),
  ];

  static const insights = [
    DashboardInsight(
      id: 'ins-1',
      title: 'Optimize evening peak',
      summary:
          'Shifting 8% of industrial load to off-peak hours could save \$142K this quarter.',
      confidence: 92,
      actionLabel: 'Review plan',
    ),
    DashboardInsight(
      id: 'ins-2',
      title: 'Maintenance window',
      summary:
          'Turbine cluster B shows early wear signals. Schedule inspection within 72 hours.',
      confidence: 87,
      actionLabel: 'Schedule',
    ),
  ];

  static const projects = [
    DashboardProject(
      id: 'proj-1',
      name: 'Project Helios',
      status: 'On track',
      progress: 0.72,
      owner: 'Sarah Chen',
    ),
    DashboardProject(
      id: 'proj-2',
      name: 'Grid Modernization',
      status: 'At risk',
      progress: 0.45,
      owner: 'Marcus Webb',
    ),
    DashboardProject(
      id: 'proj-3',
      name: 'Battery Storage Alpha',
      status: 'On track',
      progress: 0.88,
      owner: 'Elena Rodriguez',
    ),
  ];

  static final notifications = [
    DashboardNotification(
      id: 'notif-1',
      title: 'Peak demand threshold exceeded',
      body: 'North Region reached 94% capacity at 08:42.',
      timestamp: _now.subtract(const Duration(minutes: 8)),
      read: false,
      category: 'Alerts',
    ),
    DashboardNotification(
      id: 'notif-2',
      title: 'Report published',
      body: 'Weekly operations summary is ready for review.',
      timestamp: _now.subtract(const Duration(hours: 2)),
      read: false,
      category: 'Reports',
    ),
    DashboardNotification(
      id: 'notif-3',
      title: 'Approval requested',
      body: 'Marcus Webb requested sign-off on Grid Modernization Phase 1.',
      timestamp: _now.subtract(const Duration(hours: 6)),
      read: true,
      category: 'Approvals',
    ),
    DashboardNotification(
      id: 'notif-4',
      title: 'AI insight available',
      body: 'New cost optimization recommendation for Q3.',
      timestamp: _now.subtract(const Duration(days: 1)),
      read: true,
      category: 'AI',
    ),
  ];

  static const searchResults = [
    DashboardSearchResult(
      id: 'sr-1',
      title: 'Project Helios',
      subtitle: 'Solar expansion · 72% complete',
      category: 'Projects',
      route: '/dashboard',
    ),
    DashboardSearchResult(
      id: 'sr-2',
      title: 'Grid Modernization',
      subtitle: 'Infrastructure · At risk',
      category: 'Projects',
      route: '/dashboard',
    ),
    DashboardSearchResult(
      id: 'sr-3',
      title: 'Peak demand alert',
      subtitle: 'North Region · Resolved',
      category: 'Alerts',
      route: '/dashboard/notifications',
    ),
    DashboardSearchResult(
      id: 'sr-4',
      title: 'Sarah Chen',
      subtitle: 'Operations Lead',
      category: 'People',
      route: '/dashboard/profile',
    ),
    DashboardSearchResult(
      id: 'sr-5',
      title: 'AI Workspace',
      subtitle: 'Ask Voltx AI',
      category: 'Tools',
      route: '/dashboard/ai',
    ),
  ];

  static const commandPaletteItems = [
    CommandPaletteItem(
      id: 'cmd-1',
      label: 'Go to Dashboard',
      subtitle: 'Executive overview',
      iconName: 'dashboard',
      route: '/dashboard',
      keywords: ['home', 'overview', 'executive'],
    ),
    CommandPaletteItem(
      id: 'cmd-2',
      label: 'Open AI Workspace',
      subtitle: 'Chat with Voltx AI',
      iconName: 'ai',
      route: '/dashboard/ai',
      keywords: ['assistant', 'chat', 'ai'],
    ),
    CommandPaletteItem(
      id: 'cmd-3',
      label: 'View Notifications',
      subtitle: 'Alerts and updates',
      iconName: 'notifications',
      route: '/dashboard/notifications',
      keywords: ['alerts', 'inbox'],
    ),
    CommandPaletteItem(
      id: 'cmd-4',
      label: 'Search',
      subtitle: 'Find projects and people',
      iconName: 'search',
      route: '/dashboard/search',
      keywords: ['find', 'lookup'],
    ),
    CommandPaletteItem(
      id: 'cmd-5',
      label: 'Profile',
      subtitle: 'Account and preferences',
      iconName: 'person',
      route: '/dashboard/profile',
      keywords: ['account', 'user'],
    ),
    CommandPaletteItem(
      id: 'cmd-6',
      label: 'Settings',
      subtitle: 'Appearance and account',
      iconName: 'settings',
      route: '/settings',
      keywords: ['preferences', 'theme'],
    ),
    CommandPaletteItem(
      id: 'cmd-7',
      label: 'Toggle AI Panel',
      subtitle: 'Show or hide assistant',
      iconName: 'panel',
      route: '__toggle_ai__',
      keywords: ['sidebar', 'assistant'],
    ),
    CommandPaletteItem(
      id: 'cmd-8',
      label: 'Toggle Sidebar',
      subtitle: 'Collapse navigation',
      iconName: 'sidebar',
      route: '__toggle_sidebar__',
      keywords: ['nav', 'menu'],
    ),
  ];

  static final aiMessages = [
    AiChatMessage(
      id: 'ai-1',
      content:
          'Good morning. Grid output is 12% above forecast. I found two optimization opportunities for today.',
      isUser: false,
      timestamp: _now.subtract(const Duration(minutes: 30)),
    ),
    AiChatMessage(
      id: 'ai-2',
      content: 'What caused the peak demand alert in North Region?',
      isUser: true,
      timestamp: _now.subtract(const Duration(minutes: 28)),
    ),
    AiChatMessage(
      id: 'ai-3',
      content:
          'The alert was triggered at 08:42 when demand hit 94% of regional capacity. '
          'Industrial load from Sector 7 spiked 18% above baseline. Automated load balancing resolved it within 4 minutes.',
      isUser: false,
      timestamp: _now.subtract(const Duration(minutes: 27)),
    ),
  ];
}
