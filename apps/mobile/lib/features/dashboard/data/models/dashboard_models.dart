/// KPI metric displayed on the executive dashboard.
class DashboardKpi {
  const DashboardKpi({
    required this.id,
    required this.label,
    required this.value,
    required this.delta,
    required this.trend,
    required this.iconName,
  });

  final String id;
  final String label;
  final String value;
  final String delta;
  final KpiTrend trend;
  final String iconName;
}

enum KpiTrend { up, down, neutral }

/// Activity feed item.
class DashboardActivity {
  const DashboardActivity({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.timestamp,
    required this.type,
  });

  final String id;
  final String title;
  final String subtitle;
  final DateTime timestamp;
  final ActivityType type;
}

enum ActivityType { alert, update, approval, insight }

/// AI-generated insight card.
class DashboardInsight {
  const DashboardInsight({
    required this.id,
    required this.title,
    required this.summary,
    required this.confidence,
    required this.actionLabel,
  });

  final String id;
  final String title;
  final String summary;
  final int confidence;
  final String actionLabel;
}

/// Recent project summary.
class DashboardProject {
  const DashboardProject({
    required this.id,
    required this.name,
    required this.status,
    required this.progress,
    required this.owner,
  });

  final String id;
  final String name;
  final String status;
  final double progress;
  final String owner;
}

/// Notification item.
class DashboardNotification {
  const DashboardNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.timestamp,
    required this.read,
    required this.category,
  });

  final String id;
  final String title;
  final String body;
  final DateTime timestamp;
  final bool read;
  final String category;
}

/// Global search result.
class DashboardSearchResult {
  const DashboardSearchResult({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.category,
    required this.route,
  });

  final String id;
  final String title;
  final String subtitle;
  final String category;
  final String route;
}

/// Command palette action.
class CommandPaletteItem {
  const CommandPaletteItem({
    required this.id,
    required this.label,
    required this.subtitle,
    required this.iconName,
    required this.route,
    this.keywords = const [],
  });

  final String id;
  final String label;
  final String subtitle;
  final String iconName;
  final String route;
  final List<String> keywords;
}

/// AI chat message for the workspace.
class AiChatMessage {
  const AiChatMessage({
    required this.id,
    required this.content,
    required this.isUser,
    required this.timestamp,
  });

  final String id;
  final String content;
  final bool isUser;
  final DateTime timestamp;
}
