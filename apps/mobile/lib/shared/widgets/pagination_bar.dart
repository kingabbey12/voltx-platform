import 'package:flutter/material.dart';

import '../../theme/tokens/spacing.dart';
import '../../theme/voltx_theme.dart';

/// Page-based pagination control shown at the bottom of a list — used by
/// every feature that lists a `Paginated*Result` (Sales, Knowledge,
/// Workflows, Integrations). Deliberately page-based (not infinite
/// scroll) to match the backend's `{page, limit, total, totalPages}`
/// contract with no extra client-side accounting.
class PaginationBar extends StatelessWidget {
  const PaginationBar({
    required this.page,
    required this.totalPages,
    required this.onPageChanged,
    this.isLoading = false,
    super.key,
  });

  final int page;
  final int totalPages;
  final ValueChanged<int> onPageChanged;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    if (totalPages <= 1) {
      return const SizedBox.shrink();
    }

    final colors = context.voltxColors;
    final canGoBack = page > 1 && !isLoading;
    final canGoForward = page < totalPages && !isLoading;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            onPressed: canGoBack ? () => onPageChanged(page - 1) : null,
            icon: const Icon(Icons.chevron_left_rounded),
            tooltip: 'Previous page',
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            'Page $page of $totalPages',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(width: AppSpacing.sm),
          IconButton(
            onPressed: canGoForward ? () => onPageChanged(page + 1) : null,
            icon: const Icon(Icons.chevron_right_rounded),
            tooltip: 'Next page',
          ),
        ],
      ),
    );
  }
}
