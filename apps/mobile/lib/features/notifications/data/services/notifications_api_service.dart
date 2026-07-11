import '../../../../core/network/api_client.dart';
import '../models/app_notification.dart';

class NotificationsApiService {
  NotificationsApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<PaginatedNotificationsResponse> list({int page = 1, int limit = 20}) async {
    return _apiClient.get(
      '/notifications',
      queryParameters: {'page': page, 'limit': limit},
      fromJson: PaginatedNotificationsResponse.fromJson,
    );
  }

  Future<int> getUnreadCount() async {
    final response = await _apiClient.get(
      '/notifications/unread-count',
      fromJson: (json) => json['count'] as int? ?? 0,
    );
    return response;
  }

  Future<AppNotification> markRead(String id) async {
    return _apiClient.patch(
      '/notifications/$id/read',
      fromJson: AppNotification.fromJson,
    );
  }

  Future<int> markAllRead() async {
    return _apiClient.post(
      '/notifications/read-all',
      fromJson: (json) => json['count'] as int? ?? 0,
    );
  }
}

class PaginatedNotificationsResponse {
  const PaginatedNotificationsResponse({required this.items, required this.total});

  final List<AppNotification> items;
  final int total;

  factory PaginatedNotificationsResponse.fromJson(Map<String, dynamic> json) {
    return PaginatedNotificationsResponse(
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((item) => AppNotification.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      total: json['total'] as int? ?? 0,
    );
  }
}
