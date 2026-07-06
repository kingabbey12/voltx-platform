import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Provider-agnostic analytics interface. Swap [analyticsServiceProvider]'s
/// implementation for a real backend (Firebase/Amplitude/PostHog/etc.)
/// without touching any call site.
abstract class AnalyticsService {
  void logEvent(String name, {Map<String, Object?> params = const {}});

  void setUserId(String? userId);
}

/// Default no-op implementation — analytics is opt-in infrastructure with
/// no backend wired yet. Swap the provider override below once one is
/// chosen; call sites never need to change.
class NoopAnalyticsService implements AnalyticsService {
  const NoopAnalyticsService();

  @override
  void logEvent(String name, {Map<String, Object?> params = const {}}) {}

  @override
  void setUserId(String? userId) {}
}

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return const NoopAnalyticsService();
});
