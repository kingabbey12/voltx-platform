import 'package:flutter/material.dart';

import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// Success confirmation view for auth flows.
class AuthSuccessView extends StatelessWidget {
  const AuthSuccessView({
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
    super.key,
  });

  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final textTheme = Theme.of(context).textTheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: colors.successSurface,
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.check_rounded, color: colors.success, size: 36),
        ),
        const SizedBox(height: AppSpacing.md),
        Text(title, style: textTheme.headlineSmall),
        const SizedBox(height: AppSpacing.xs),
        Text(
          message,
          style: textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        VoltxButton(
          label: actionLabel,
          isExpanded: true,
          size: VoltxButtonSize.large,
          onPressed: onAction,
        ),
      ],
    );
  }
}
