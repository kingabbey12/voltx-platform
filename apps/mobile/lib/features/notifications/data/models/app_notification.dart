/// A real, server-persisted in-app notification — GET /notifications.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.organizationId,
    required this.userId,
    required this.category,
    required this.title,
    required this.body,
    required this.actionUrl,
    required this.read,
    required this.createdAt,
  });

  final String id;
  final String organizationId;
  final String userId;
  final String category;
  final String title;
  final String? body;
  final String? actionUrl;
  final bool read;
  final DateTime createdAt;

  AppNotification copyWith({bool? read}) {
    return AppNotification(
      id: id,
      organizationId: organizationId,
      userId: userId,
      category: category,
      title: title,
      body: body,
      actionUrl: actionUrl,
      read: read ?? this.read,
      createdAt: createdAt,
    );
  }

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String,
      organizationId: json['organizationId'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      category: json['category'] as String? ?? 'AI',
      title: json['title'] as String? ?? '',
      body: json['body'] as String?,
      actionUrl: json['actionUrl'] as String?,
      read: json['read'] as bool? ?? false,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
