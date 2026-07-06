import 'package:flutter/material.dart';

/// Standard pull-to-refresh wrapper — wraps any scrollable content and
/// invokes [onRefresh] (typically `ref.invalidate(someProvider)` followed
/// by awaiting `ref.read(someProvider.future)`, or a repository call) when
/// the user pulls down. Every list screen in the app should be wrapped in
/// this rather than each screen re-implementing [RefreshIndicator].
class PullToRefresh extends StatelessWidget {
  const PullToRefresh({
    required this.onRefresh,
    required this.child,
    super.key,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: child,
    );
  }
}
