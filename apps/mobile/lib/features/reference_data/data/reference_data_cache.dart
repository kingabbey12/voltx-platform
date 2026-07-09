import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Offline cache for reference data (countries/states/cities/currencies/
/// timezones/industries/languages) — this data is effectively static, so a
/// long TTL is safe, and a stale-but-present cache entry is always
/// preferred over a hard failure when the device is offline. This is the
/// first real usage of `shared_preferences` in the app (previously an
/// unused dependency).
class ReferenceDataCache {
  ReferenceDataCache(this._prefsFuture);

  final Future<SharedPreferences> _prefsFuture;

  static const Duration _ttl = Duration(days: 30);

  /// Returns cached items if present and within TTL, otherwise null (the
  /// caller should fetch fresh and call [write]).
  Future<List<T>?> read<T>(
    String key,
    T Function(Map<String, dynamic> json) fromJson,
  ) async {
    final entry = await _readEntry(key);
    if (entry == null) return null;
    if (DateTime.now().difference(entry.cachedAt) > _ttl) return null;
    return entry.items.map((e) => fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  /// Same as [read] but ignores TTL — used as an offline fallback when a
  /// fresh network fetch fails but *some* prior cache exists.
  Future<List<T>?> readStale<T>(
    String key,
    T Function(Map<String, dynamic> json) fromJson,
  ) async {
    final entry = await _readEntry(key);
    if (entry == null) return null;
    return entry.items.map((e) => fromJson(Map<String, dynamic>.from(e as Map))).toList();
  }

  Future<void> write<T>(
    String key,
    List<T> items,
    Map<String, dynamic> Function(T item) toJson,
  ) async {
    await _writeRaw(key, items.map(toJson).toList());
  }

  Future<List<String>?> readStrings(String key) async {
    final entry = await _readEntry(key);
    if (entry == null) return null;
    if (DateTime.now().difference(entry.cachedAt) > _ttl) return null;
    return entry.items.map((e) => e as String).toList();
  }

  Future<List<String>?> readStaleStrings(String key) async {
    final entry = await _readEntry(key);
    if (entry == null) return null;
    return entry.items.map((e) => e as String).toList();
  }

  Future<void> writeStrings(String key, List<String> items) async {
    await _writeRaw(key, items);
  }

  Future<_CacheEntry?> _readEntry(String key) async {
    final prefs = await _prefsFuture;
    final raw = prefs.getString(key);
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      return _CacheEntry(
        cachedAt: DateTime.parse(decoded['cachedAt'] as String),
        items: decoded['items'] as List<dynamic>,
      );
    } catch (_) {
      // Corrupt/old-shape cache entry — treat as a miss rather than crash.
      return null;
    }
  }

  Future<void> _writeRaw(String key, List<dynamic> items) async {
    final prefs = await _prefsFuture;
    final payload = jsonEncode({
      'cachedAt': DateTime.now().toIso8601String(),
      'items': items,
    });
    await prefs.setString(key, payload);
  }
}

class _CacheEntry {
  const _CacheEntry({required this.cachedAt, required this.items});
  final DateTime cachedAt;
  final List<dynamic> items;
}
