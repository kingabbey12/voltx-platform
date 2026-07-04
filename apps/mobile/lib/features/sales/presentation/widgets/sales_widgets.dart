import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
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
    return VoltxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
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
                              color: context.voltxColors.textSecondary,
                            ),
                      ),
                    ],
                  ],
                ),
              ),
              ?trailing,
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
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
    final scheme = Theme.of(context).colorScheme;
    return VoltxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: scheme.primary),
          const SizedBox(height: AppSpacing.sm),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(label, style: Theme.of(context).textTheme.bodyMedium),
          if (footnote != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              footnote!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.voltxColors.textSecondary,
                  ),
            ),
          ],
        ],
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
    final normalized = label.toUpperCase();
    final color = switch (normalized) {
      'QUALIFIED' || 'ACTIVE' || 'CLOSED_WON' => Colors.green,
      'NEGOTIATION' || 'PROPOSAL' || 'NURTURING' => Colors.orange,
      'DISQUALIFIED' || 'INACTIVE' || 'CLOSED_LOST' => Colors.red,
      _ => scheme.primary,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
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
    if (state.isLoading) {
      return const SalesSectionCard(
        title: 'Copilot',
        subtitle: 'Generating response',
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
          child: Center(child: CircularProgressIndicator()),
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
        child: Text(state.errorMessage!),
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
      child: SelectableText(state.result!.outputText),
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
    return Material(
      color: Colors.transparent,
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
        onTap: () => context.push(route),
      ),
    );
  }
}
