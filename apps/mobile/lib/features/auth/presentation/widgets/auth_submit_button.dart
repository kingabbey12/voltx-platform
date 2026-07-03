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
    super.key,
  });

  final String label;
  final AsyncValue<String?> formState;
  final VoidCallback? onPressed;
  final double topSpacing;

  @override
  Widget build(BuildContext context) {
    final isLoading = formState.isLoading;

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
