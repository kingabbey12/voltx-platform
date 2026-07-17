import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/network/api_client.dart';
import 'package:voltx_mobile/features/notifications/data/models/app_notification.dart';
import 'package:voltx_mobile/features/notifications/data/services/notifications_api_service.dart';
import 'package:voltx_mobile/features/notifications/presentation/providers/notifications_providers.dart';

AppNotification _notification({String id = 'notif-1', bool read = false}) {
  return AppNotification(
    id: id,
    organizationId: 'org-1',
    userId: 'user-1',
    category: 'AI',
    title: 'Hello',
    body: null,
    actionUrl: null,
    read: read,
    createdAt: DateTime(2026, 1, 1),
  );
}

/// Test double standing in for the real HTTP-backed service, mirroring
/// FakeAttachmentRepository's pattern in test/attachments/.
class FakeNotificationsApiService extends NotificationsApiService {
  FakeNotificationsApiService() : super(ApiClient(Dio()));

  List<AppNotification> items = const [];
  int unreadCount = 0;
  Object? listError;
  Object? markReadError;
  Object? markAllReadError;
  final List<String> markReadCalls = [];
  int markAllReadCalls = 0;

  @override
  Future<PaginatedNotificationsResponse> list({int page = 1, int limit = 20}) async {
    if (listError != null) throw listError!;
    return PaginatedNotificationsResponse(items: items, total: items.length);
  }

  @override
  Future<int> getUnreadCount() async => unreadCount;

  @override
  Future<AppNotification> markRead(String id) async {
    markReadCalls.add(id);
    if (markReadError != null) throw markReadError!;
    return _notification(id: id, read: true);
  }

  @override
  Future<int> markAllRead() async {
    markAllReadCalls += 1;
    if (markAllReadError != null) throw markAllReadError!;
    return 0;
  }
}

void main() {
  group('AppNotification.fromJson', () {
    test('defaults category to AI and read to false when omitted', () {
      final notification = AppNotification.fromJson({'id': 'notif-1'});

      expect(notification.category, 'AI');
      expect(notification.title, '');
      expect(notification.read, isFalse);
    });

    test('falls back createdAt to now when missing/unparseable', () {
      final before = DateTime.now();
      final notification = AppNotification.fromJson({'id': 'notif-1', 'createdAt': 'not-a-date'});
      expect(notification.createdAt.isAfter(before.subtract(const Duration(seconds: 5))), isTrue);
    });
  });

  group('AppNotification.copyWith', () {
    test('changes only the read flag, keeping every other field', () {
      final original = _notification();
      final updated = original.copyWith(read: true);

      expect(updated.read, isTrue);
      expect(updated.id, original.id);
      expect(updated.title, original.title);
    });
  });

  group('PaginatedNotificationsResponse.fromJson', () {
    test('defaults total to 0 and items to an empty list when omitted', () {
      final response = PaginatedNotificationsResponse.fromJson(const {});
      expect(response.items, isEmpty);
      expect(response.total, 0);
    });
  });

  group('NotificationsNotifier', () {
    late FakeNotificationsApiService api;
    late ProviderContainer container;

    setUp(() {
      api = FakeNotificationsApiService();
      container = ProviderContainer(
        overrides: [notificationsApiServiceProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);
    });

    test('markRead optimistically flips only the target item read', () async {
      api.items = [_notification(id: 'notif-1'), _notification(id: 'notif-2')];
      final notifier = container.read(notificationsProvider.notifier);
      await notifier.reload();

      await notifier.markRead('notif-1');

      final state = container.read(notificationsProvider);
      expect(state.firstWhere((n) => n.id == 'notif-1').read, isTrue);
      expect(state.firstWhere((n) => n.id == 'notif-2').read, isFalse);
      expect(api.markReadCalls, ['notif-1']);
    });

    test('markRead is a no-op for an already-read notification', () async {
      api.items = [_notification(id: 'notif-1', read: true)];
      final notifier = container.read(notificationsProvider.notifier);
      await notifier.reload();

      await notifier.markRead('notif-1');

      expect(api.markReadCalls, isEmpty);
    });

    test('markRead keeps the optimistic update even when the server call fails', () async {
      api.items = [_notification(id: 'notif-1')];
      api.markReadError = StateError('network down');
      final notifier = container.read(notificationsProvider.notifier);
      await notifier.reload();

      await notifier.markRead('notif-1');

      expect(container.read(notificationsProvider).single.read, isTrue);
    });

    test('markAllRead marks every item read and resets the unread count', () async {
      api.items = [_notification(id: 'notif-1'), _notification(id: 'notif-2')];
      final notifier = container.read(notificationsProvider.notifier);
      await notifier.reload();

      await notifier.markAllRead();

      expect(container.read(notificationsProvider).every((n) => n.read), isTrue);
      expect(api.markAllReadCalls, 1);
      expect(container.read(unreadNotificationCountProvider), 0);
    });

    test('markAllRead is a no-op when nothing is unread', () async {
      api.items = [_notification(id: 'notif-1', read: true)];
      final notifier = container.read(notificationsProvider.notifier);
      await notifier.reload();

      await notifier.markAllRead();

      expect(api.markAllReadCalls, 0);
    });

    test('reload falls back to an empty list when the server call fails', () async {
      api.listError = StateError('network down');
      final notifier = container.read(notificationsProvider.notifier);

      await notifier.reload();

      expect(container.read(notificationsProvider), isEmpty);
    });
  });

  group('NotificationsUnreadCountNotifier', () {
    test('decrement reduces a positive count by one', () {
      final notifier = NotificationsUnreadCountNotifier(FakeNotificationsApiService());
      addTearDown(notifier.dispose);

      notifier.state = 5;
      notifier.decrement();
      expect(notifier.state, 4);
    });

    test('decrement never goes below zero', () {
      final notifier = NotificationsUnreadCountNotifier(FakeNotificationsApiService());
      addTearDown(notifier.dispose);

      notifier.decrement();
      expect(notifier.state, 0);
    });

    test('reset sets a positive count back to zero', () {
      final notifier = NotificationsUnreadCountNotifier(FakeNotificationsApiService());
      addTearDown(notifier.dispose);

      notifier.state = 3;
      notifier.reset();
      expect(notifier.state, 0);
    });
  });
}
