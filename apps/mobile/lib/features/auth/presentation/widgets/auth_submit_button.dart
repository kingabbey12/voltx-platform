import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/spacing.dart';

/// Primary submit button wired to auth form async state.
class AuthSubmitButton extends StatelessWidget {
  const AuthSubmitButton({
    required this.label,
    required this.formState,
    required this.onPressed,
    this.topSpacing = AppSpacing.md,
    this.isSubmitting = false,
    super.key,
  });

  final String label;
  final AsyncValue<String?> formState;
  final VoidCallback? onPressed;
  final double topSpacing;
  final bool isSubmitting;

  @override
  Widget build(BuildContext context) {
    final isLoading = formState.isLoading || isSubmitting;

    return Padding(
      padding: EdgeInsets.only(top: topSpacing),
      child: VoltxButton(
        label: label,
        isExpanded: true,
        size: VoltxButtonSize.large,
        isLoading: isLoading,
        onPressed: isLoading ? null : onPressed,
      ),
    );
  }
}
