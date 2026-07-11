import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/app_notification.dart';
import '../../data/services/notifications_api_service.dart';

bool _hasFlutterBinding() {
  try {
    WidgetsBinding.instance;
    return true;
  } catch (_) {
    return false;
  }
}

final notificationsApiServiceProvider = Provider<NotificationsApiService>((ref) {
  return NotificationsApiService(ref.watch(apiClientProvider));
});

/// Poll interval for near-real-time delivery. The backend's realtime push
/// (`CommsGateway`) is Socket.IO-based; mobile has no existing socket
/// client to extend the way `apps/web/src/hooks/use-comms-realtime.ts`
/// extends one (web already held a live connection for the unified
/// inbox). Adding a whole new persistent-connection dependency/lifecycle
/// is out of scope for a hardening release, so delivery here is a short
/// poll instead — matching the same 30s cadence the web menu already
/// falls back to (`use-notifications.ts`'s `refetchInterval`).
const _pollInterval = Duration(seconds: 30);

/// Real, server-persisted notification inbox — GET /notifications.
/// Mirrors the `AiConversationsNotifier` convention: loads once on
/// construction, falls back to an empty list outside a Flutter binding
/// (pure-Dart unit tests), and exposes `reload`/`markRead`/`markAllRead`
/// that call through to the backend before updating local state.
class NotificationsNotifier extends StateNotifier<List<AppNotification>> {
  NotificationsNotifier(this._ref, this._api) : super(const []) {
    if (!_hasFlutterBinding()) {
      return;
    }
    unawaited(_load());
    _pollTimer = Timer.periodic(_pollInterval, (_) => unawaited(_load()));
  }

  final Ref _ref;
  final NotificationsApiService _api;
  Timer? _pollTimer;

  Future<void> _load() async {
    try {
      final page = await _api.list(limit: 50);
      state = page.items;
    } catch (_) {
      state = const [];
    }
  }

  Future<void> reload() => _load();

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> markRead(String id) async {
    final target = state.where((item) => item.id == id).firstOrNull;
    if (target == null || target.read) {
      return;
    }
    state = [
      for (final item in state)
        if (item.id == id) item.copyWith(read: true) else item,
    ];
    _ref.read(unreadNotificationCountProvider.notifier).decrement();
    try {
      await _api.markRead(id);
    } catch (_) {
      // Optimistic update stands; next reload() reconciles with the server.
    }
  }

  Future<void> markAllRead() async {
    final hadUnread = state.any((item) => !item.read);
    if (!hadUnread) {
      return;
    }
    state = [for (final item in state) item.copyWith(read: true)];
    _ref.read(unreadNotificationCountProvider.notifier).reset();
    try {
      await _api.markAllRead();
    } catch (_) {
      // Optimistic update stands; next reload() reconciles with the server.
    }
  }
}

final notificationsProvider = StateNotifierProvider<NotificationsNotifier, List<AppNotification>>((ref) {
  return NotificationsNotifier(ref, ref.watch(notificationsApiServiceProvider));
});

/// Server-computed unread count — GET /notifications/unread-count. Kept
/// independent of [notificationsProvider]'s state (which only holds the
/// first page) so the badge reflects the true total, with local
/// optimistic adjustments on mark-read/mark-all-read.
class NotificationsUnreadCountNotifier extends StateNotifier<int> {
  NotificationsUnreadCountNotifier(this._api) : super(0) {
    if (!_hasFlutterBinding()) {
      return;
    }
    unawaited(_load());
    _pollTimer = Timer.periodic(_pollInterval, (_) => unawaited(_load()));
  }

  final NotificationsApiService _api;
  Timer? _pollTimer;

  Future<void> _load() async {
    try {
      state = await _api.getUnreadCount();
    } catch (_) {
      state = 0;
    }
  }

  Future<void> reload() => _load();

  void decrement() {
    if (state > 0) {
      state = state - 1;
    }
  }

  void reset() {
    state = 0;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}

final unreadNotificationCountProvider = StateNotifierProvider<NotificationsUnreadCountNotifier, int>((ref) {
  return NotificationsUnreadCountNotifier(ref.watch(notificationsApiServiceProvider));
});
