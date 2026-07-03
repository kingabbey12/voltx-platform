import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../router/routes.dart';
import '../../../shared/widgets/responsive_layout.dart';
import '../../../theme/components/voltx_button.dart';
import '../../../theme/components/voltx_card.dart';
import '../../../theme/components/voltx_chip.dart';
import '../../../theme/components/voltx_dialog.dart';
import '../../../theme/components/voltx_snackbar.dart';
import '../../../theme/components/voltx_text_field.dart';
import '../../../theme/tokens/spacing.dart';
import '../../../theme/voltx_theme.dart';

/// Gallery of Voltx design system components and foundation states.
class ComponentsScreen extends StatelessWidget {
  const ComponentsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Components')),
      body: ResponsiveLayout(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          children: [
            Text(
              'Design System',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Apple clarity with Linear minimalism.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.voltxColors.textSecondary,
                  ),
            ),
            const SizedBox(height: AppSpacing.md),
            const _SectionTitle('Buttons'),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                VoltxButton(
                  label: 'Primary',
                  onPressed: () {},
                ),
                VoltxButton(
                  label: 'Secondary',
                  variant: VoltxButtonVariant.secondary,
                  onPressed: () {},
                ),
                VoltxButton(
                  label: 'Ghost',
                  variant: VoltxButtonVariant.ghost,
                  onPressed: () {},
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            const _SectionTitle('Chips'),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: const [
                VoltxChip(label: 'Neutral', selected: true),
                VoltxChip(label: 'Success', variant: VoltxChipVariant.success),
                VoltxChip(label: 'Warning', variant: VoltxChipVariant.warning),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            const _SectionTitle('Text Field'),
            const VoltxTextField(
              label: 'Email',
              hint: 'name@company.com',
              helper: 'We never share your email.',
              prefixIcon: Icons.mail_outline_rounded,
            ),
            const SizedBox(height: AppSpacing.md),
            const _SectionTitle('Feedback'),
            VoltxCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  VoltxButton(
                    label: 'Show Dialog',
                    variant: VoltxButtonVariant.secondary,
                    onPressed: () {
                      showVoltxDialog<void>(
                        context: context,
                        title: 'Voltx Dialog',
                        message: 'Minimal dialog surface with accessible actions.',
                        secondaryActionLabel: 'Cancel',
                        primaryActionLabel: 'Confirm',
                      );
                    },
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  VoltxButton(
                    label: 'Show Snackbar',
                    variant: VoltxButtonVariant.ghost,
                    onPressed: () {
                      showVoltxSnackbar(
                        context,
                        message: 'Changes saved successfully.',
                        variant: VoltxSnackbarVariant.success,
                      );
                    },
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            const _SectionTitle('Foundation States'),
            _ComponentTile(
              icon: Icons.hourglass_top_rounded,
              title: 'Loading Screen',
              subtitle: 'Full-screen progress indicator',
              onTap: () => context.push(AppRoutes.loading),
            ),
            _ComponentTile(
              icon: Icons.error_outline_rounded,
              title: 'Error Screen',
              subtitle: 'Recoverable error with retry action',
              onTap: () => context.push(AppRoutes.error),
            ),
            _ComponentTile(
              icon: Icons.inbox_outlined,
              title: 'Empty State',
              subtitle: 'Placeholder for empty collections',
              onTap: () => context.push(AppRoutes.empty),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Text(
        label,
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: context.voltxColors.textSecondary,
            ),
      ),
    );
  }
}

class _ComponentTile extends StatelessWidget {
  const _ComponentTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return VoltxCard(
      onTap: onTap,
      padding: EdgeInsets.zero,
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right_rounded),
      ),
    );
  }
}
