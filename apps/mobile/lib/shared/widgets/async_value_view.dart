import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/network/network_exception.dart';
import '../../theme/tokens/spacing.dart';
import '../../theme/voltx_theme.dart';

/// Renders an [AsyncValue] with consistent inline loading / error(+retry) /
/// empty / data states. Unlike [LoadingScreen]/[ErrorScreen] (which are
/// full-page), this is meant to be embedded inside an existing scaffold or
/// scroll view — the standard way every list/detail screen in the app
/// should consume a provider from here on.
class AsyncValueView<T> extends StatelessWidget {
  const AsyncValueView({
    required this.value,
    required this.data,
    this.onRetry,
    this.isEmpty,
    this.empty,
    this.loadingHeight = 160,
    super.key,
  });

  final AsyncValue<T> value;
  final Widget Function(BuildContext context, T data) data;
  final VoidCallback? onRetry;
  final bool Function(T data)? isEmpty;
  final WidgetBuilder? empty;
  final double loadingHeight;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: (result) {
        if (isEmpty != null && isEmpty!(result) && empty != null) {
          return empty!(context);
        }
        return data(context, result);
      },
      loading: () => SizedBox(
        height: loadingHeight,
        child: const Center(child: CircularProgressIndicator()),
      ),
      error: (error, stackTrace) => InlineErrorCard(
        message: friendlyMessageFor(error),
        onRetry: onRetry,
      ),
    );
  }

  /// Extracts a user-friendly message from any error — shared by
  /// [AsyncValueView] itself and by call sites that render an
  /// [InlineErrorCard] directly for a nested/secondary `.when()` branch
  /// (e.g. a linked-records list on a detail screen) instead of wrapping
  /// the whole `AsyncValue` in [AsyncValueView].
  static String friendlyMessageFor(Object error) {
    if (error is NetworkException) {
      return switch (error.type) {
        NetworkExceptionType.offline => 'You appear to be offline. Check your connection and retry.',
        NetworkExceptionType.timeout => 'The request timed out. Please retry.',
        _ => error.message,
      };
    }
    return error.toString();
  }
}

/// Inline (non-full-screen) error card with an optional retry action —
/// used both directly by [AsyncValueView] and standalone for
/// action-triggered failures (e.g. a mutation that failed).
class InlineErrorCard extends StatelessWidget {
  const InlineErrorCard({
    required this.message,
    this.title = 'Unable to load this content',
    this.onRetry,
    super.key,
  });

  final String title;
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.error.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.error.withValues(alpha: 0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.error_outline_rounded, color: colors.error, size: 20),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            message,
            style: textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Retry'),
            ),
          ],
        ],
      ),
    );
  }
}
