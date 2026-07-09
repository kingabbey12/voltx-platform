import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../auth/presentation/widgets/auth_staggered_fade.dart';
import '../providers/onboarding_providers.dart';

class _ConnectApp {
  const _ConnectApp({required this.provider, required this.label, required this.icon});

  final String provider;
  final String label;
  final IconData icon;
}

const List<_ConnectApp> _apps = [
  _ConnectApp(provider: 'GOOGLE_GMAIL', label: 'Gmail', icon: Icons.mail_outline_rounded),
  _ConnectApp(
    provider: 'MICROSOFT_OUTLOOK',
    label: 'Outlook',
    icon: Icons.forward_to_inbox_outlined,
  ),
  _ConnectApp(provider: 'SLACK', label: 'Slack', icon: Icons.tag_rounded),
  _ConnectApp(provider: 'GOOGLE_DRIVE', label: 'Google Drive', icon: Icons.cloud_outlined),
];

class OnboardingConnectAppsStep extends ConsumerWidget {
  const OnboardingConnectAppsStep({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final connectedAsync = ref.watch(onboardingConnectedAppsProvider);

    return AuthStaggeredFade(
      children: [
        Text('Connect your tools', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Voltx agents work best with context from the tools your team already uses.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        AsyncValueView(
          value: connectedAsync,
          onRetry: () => ref.invalidate(onboardingConnectedAppsProvider),
          data: (context, connected) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final app in _apps) ...[
                Container(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: BoxDecoration(
                    color: colors.surfaceElevated.withValues(alpha: 0.6),
                    borderRadius: radii.mdBorder,
                    border: Border.all(color: colors.borderSubtle),
                  ),
                  child: Row(
                    children: [
                      Icon(app.icon, color: colors.textPrimary, size: 22),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          app.label,
                          style: Theme.of(context).textTheme.bodyLarge,
                        ),
                      ),
                      if (connected.contains(app.provider))
                        _StatusPill(
                          label: 'Connected',
                          color: colors.success,
                          background: colors.successSurface,
                          icon: Icons.check_circle_rounded,
                        )
                      else
                        _StatusPill(
                          label: 'Available later',
                          color: colors.textSecondary,
                          background: colors.surfaceMuted,
                          icon: Icons.schedule_rounded,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
              ],
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Google, Microsoft, and Slack connections use a secure web sign-in. '
                "Connect them anytime from Settings → Integrations — this won't block setup.",
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textTertiary),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        VoltxButton(
          label: 'Continue',
          isExpanded: true,
          size: VoltxButtonSize.large,
          onPressed: () => ref.read(onboardingControllerProvider.notifier).continueToComplete(),
        ),
      ],
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.color,
    required this.background,
    required this.icon,
  });

  final String label;
  final Color color;
  final Color background;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}
