import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../dashboard/presentation/widgets/dashboard_v2_tokens.dart';
import '../providers/sales_providers.dart';

class SalesSectionCard extends StatelessWidget {
  const SalesSectionCard({
    required this.title,
    required this.child,
    this.subtitle,
    this.trailing,
    super.key,
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    Widget headerContent() {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: t.textSecondary,
                  ),
            ),
          ],
        ],
      );
    }

    return VoltxCard(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              t.panel.withValues(alpha: 0.94),
              t.panelStrong.withValues(alpha: 0.9),
            ],
          ),
          borderRadius: BorderRadius.circular(t.radiusXl),
          border: Border.all(color: t.border.withValues(alpha: 0.9)),
          boxShadow: t.cardShadow,
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                final compactHeader = trailing != null && constraints.maxWidth < 420;

                if (compactHeader) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      headerContent(),
                      const SizedBox(height: AppSpacing.sm),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: trailing!,
                      ),
                    ],
                  );
                }

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: headerContent()),
                    if (trailing != null) ...[
                      const SizedBox(width: AppSpacing.sm),
                      Flexible(child: trailing!),
                    ],
                  ],
                );
              },
            ),
            const SizedBox(height: AppSpacing.md),
            child,
          ],
        ),
      ),
    );
  }
}

class SalesMetricCard extends StatelessWidget {
  const SalesMetricCard({
    required this.label,
    required this.value,
    required this.icon,
    this.footnote,
    super.key,
  });

  final String label;
  final String value;
  final IconData icon;
  final String? footnote;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    return VoltxCard(
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(t.radiusXl),
          border: Border.all(color: t.border),
          color: t.panel.withValues(alpha: 0.86),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: t.primary),
          const SizedBox(height: AppSpacing.sm),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: t.textPrimary,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: t.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
          ),
          if (footnote != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              footnote!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: t.textTertiary,
                  ),
            ),
          ],
        ],
      ),
      ),
    );
  }
}

class SalesStatusChip extends StatelessWidget {
  const SalesStatusChip(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final t = DashboardV2Tokens.of(context);
    final normalized = label.toUpperCase();
    final color = switch (normalized) {
      'QUALIFIED' || 'ACTIVE' || 'CLOSED_WON' => t.success,
      'NEGOTIATION' || 'PROPOSAL' || 'NURTURING' => t.warning,
      'DISQUALIFIED' || 'INACTIVE' || 'CLOSED_LOST' => t.error,
      _ => scheme.primary,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        normalized.replaceAll('_', ' '),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class SalesAiResultCard extends StatelessWidget {
  const SalesAiResultCard({
    required this.state,
    this.onClear,
    super.key,
  });

  final SalesCopilotState state;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    if (state.isLoading) {
      return SalesSectionCard(
        title: 'Copilot',
        subtitle: 'Generating response',
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SalesSkeletonLine(width: 220),
            SizedBox(height: AppSpacing.sm),
            SalesSkeletonLine(),
            SizedBox(height: AppSpacing.xs),
            SalesSkeletonLine(),
          ],
        ),
      );
    }

    if (state.errorMessage != null) {
      return SalesSectionCard(
        title: state.activeAction ?? 'Copilot',
        subtitle: 'Request failed',
        trailing: onClear == null
            ? null
            : TextButton(onPressed: onClear, child: const Text('Clear')),
        child: Text(
          state.errorMessage!,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: t.error),
        ),
      );
    }

    if (state.result == null) {
      return const SalesSectionCard(
        title: 'Copilot',
        subtitle: 'Run an AI action to see results here',
        child: Text('Lead qualification, email drafting, meeting summaries, and opportunity guidance will appear here.'),
      );
    }

    return SalesSectionCard(
      title: state.activeAction ?? 'Copilot Result',
      subtitle: 'Conversation ${state.result!.conversationId.substring(0, 8)}',
      trailing: onClear == null
          ? null
          : TextButton(onPressed: onClear, child: const Text('Clear')),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SalesStatusChip(state.activeAction ?? 'Copilot'),
          const SizedBox(height: AppSpacing.sm),
          SelectableText(
            state.result!.outputText,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  height: 1.45,
                  color: t.textPrimary,
                ),
          ),
        ],
      ),
    );
  }
}

class SalesLinkTile extends StatelessWidget {
  const SalesLinkTile({
    required this.title,
    required this.subtitle,
    required this.route,
    super.key,
  });

  final String title;
  final String subtitle;
  final String route;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    return Material(
      color: Colors.transparent,
      child: ListTile(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentPadding: EdgeInsets.zero,
        title: Text(title),
        subtitle: Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
        ),
        trailing: Icon(Icons.chevron_right_rounded, color: t.textTertiary),
        onTap: () => context.push(route),
      ),
    );
  }
}

class SalesSkeletonLine extends StatelessWidget {
  const SalesSkeletonLine({
    this.width,
    this.height = 12,
    super.key,
  });

  final double? width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: t.panelStrong,
        borderRadius: BorderRadius.circular(999),
      ),
    );
  }
}

class SalesEmptyState extends StatelessWidget {
  const SalesEmptyState({
    required this.title,
    required this.subtitle,
    required this.icon,
    super.key,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      child: Column(
        children: [
          Icon(icon, size: 28, color: t.textTertiary),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: t.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: t.textSecondary),
          ),
        ],
      ),
    );
  }
}

class SalesProbabilityBar extends StatelessWidget {
  const SalesProbabilityBar({
    required this.value,
    super.key,
  });

  final int value;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final clamped = value.clamp(0, 100).toDouble();
    final color = clamped >= 70
        ? t.success
        : clamped >= 40
            ? t.warning
            : t.error;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'Deal probability',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
            ),
            const Spacer(),
            Text(
              '${clamped.round()}%',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            minHeight: 7,
            value: clamped / 100,
            backgroundColor: t.panelStrong,
            color: color,
          ),
        ),
      ],
    );
  }
}

class SalesRecommendationCard extends StatelessWidget {
  const SalesRecommendationCard({
    required this.title,
    required this.body,
    required this.icon,
    this.action,
    super.key,
  });

  final String title;
  final String body;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: t.panelStrong.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(t.radiusLg),
        border: Border.all(color: t.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: t.primary),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: t.textPrimary,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            body,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: t.textSecondary,
                  height: 1.35,
                ),
          ),
          if (action != null) ...[
            const SizedBox(height: AppSpacing.sm),
            action!,
          ],
        ],
      ),
    );
  }
}
