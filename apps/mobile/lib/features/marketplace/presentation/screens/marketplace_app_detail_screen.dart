import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/marketplace_models.dart';
import '../providers/marketplace_providers.dart';

class MarketplaceAppDetailScreen extends ConsumerWidget {
  const MarketplaceAppDetailScreen({required this.appId, super.key});

  final String appId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final app = ref.watch(publishedAppDetailProvider(appId));
    final reviews = ref.watch(publicReviewsProvider(appId));
    final actionState = ref.watch(marketplaceActionControllerProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('App details')),
      body: AsyncValueView<PublicMarketplaceApp>(
        value: app,
        onRetry: () => ref.invalidate(publishedAppDetailProvider(appId)),
        data: (context, result) => ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: context.voltxColors.surfaceMuted,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  alignment: Alignment.center,
                  child: Icon(Icons.widgets_outlined, color: context.voltxColors.textSecondary, size: 28),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(result.name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                      Row(
                        children: [
                          Icon(Icons.star_rounded, size: 16, color: context.voltxColors.warning),
                          const SizedBox(width: 2),
                          Text('${result.averageRating.toStringAsFixed(1)} (${result.reviewCount} reviews)'),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (result.description != null) ...[
              const SizedBox(height: AppSpacing.md),
              Text(result.description!, style: Theme.of(context).textTheme.bodyMedium),
            ],
            const SizedBox(height: AppSpacing.md),
            if (actionState.errorMessage != null) ...[
              InlineErrorCard(message: actionState.errorMessage!),
              const SizedBox(height: AppSpacing.md),
            ],
            FilledButton.icon(
              onPressed: actionState.isLoading ? null : () => _install(context, ref),
              icon: const Icon(Icons.download_rounded),
              label: Text(result.priceCents == null || result.priceCents == 0
                  ? 'Install (Free)'
                  : 'Install (\$${(result.priceCents! / 100).toStringAsFixed(2)})'),
            ),
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: [
                Expanded(
                  child: Text('Reviews', style: Theme.of(context).textTheme.titleMedium),
                ),
                TextButton.icon(
                  onPressed: () => _showReviewDialog(context, ref),
                  icon: const Icon(Icons.rate_review_outlined, size: 18),
                  label: const Text('Write a review'),
                ),
              ],
            ),
            AsyncValueView<List<MarketplaceReview>>(
              value: reviews,
              onRetry: () => ref.invalidate(publicReviewsProvider(appId)),
              isEmpty: (result) => result.isEmpty,
              empty: (context) => const EmptyState(
                icon: Icons.rate_review_outlined,
                title: 'No reviews yet',
                message: 'Be the first to review this app.',
              ),
              data: (context, result) => Column(
                children: [
                  for (final review in result)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: VoltxCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                for (var i = 0; i < 5; i++)
                                  Icon(
                                    i < review.rating ? Icons.star_rounded : Icons.star_border_rounded,
                                    size: 16,
                                    color: context.voltxColors.warning,
                                  ),
                              ],
                            ),
                            if (review.comment != null) ...[
                              const SizedBox(height: AppSpacing.xxs),
                              Text(review.comment!, style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _install(BuildContext context, WidgetRef ref) async {
    final result = await ref.read(marketplaceActionControllerProvider.notifier).install(appId);
    if (!context.mounted) return;
    if (result == null) {
      showVoltxSnackbar(
        context,
        message: ref.read(marketplaceActionControllerProvider).errorMessage ?? 'Unable to install app',
        variant: VoltxSnackbarVariant.error,
      );
      return;
    }
    if (result.checkoutUrl != null) {
      showVoltxSnackbar(
        context,
        message: 'Complete checkout to finish installing — open this app on the web to pay.',
        variant: VoltxSnackbarVariant.info,
      );
    } else {
      showVoltxSnackbar(context, message: 'App installed', variant: VoltxSnackbarVariant.success);
    }
  }

  void _showReviewDialog(BuildContext context, WidgetRef ref) {
    showDialog<void>(context: context, builder: (context) => _ReviewDialog(appId: appId));
  }
}

class _ReviewDialog extends ConsumerStatefulWidget {
  const _ReviewDialog({required this.appId});

  final String appId;

  @override
  ConsumerState<_ReviewDialog> createState() => _ReviewDialogState();
}

class _ReviewDialogState extends ConsumerState<_ReviewDialog> {
  int _rating = 5;
  final _commentController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Write a review'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                for (var i = 1; i <= 5; i++)
                  IconButton(
                    onPressed: () => setState(() => _rating = i),
                    icon: Icon(
                      i <= _rating ? Icons.star_rounded : Icons.star_border_rounded,
                      color: context.voltxColors.warning,
                    ),
                  ),
              ],
            ),
            TextField(
              controller: _commentController,
              decoration: const InputDecoration(labelText: 'Comment (optional)'),
              maxLines: 3,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: TextStyle(color: context.voltxColors.error)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Submit'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    final success = await ref.read(marketplaceActionControllerProvider.notifier).createReview(
          widget.appId,
          rating: _rating,
          comment: _commentController.text.trim().isEmpty ? null : _commentController.text.trim(),
        );
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _submitting = false;
        _error = ref.read(marketplaceActionControllerProvider).errorMessage;
      });
    }
  }
}
