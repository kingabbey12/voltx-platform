import 'package:flutter/material.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// Auth layout shell with responsive padding and optional footer.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    required this.body,
    this.footer,
    this.showBackButton = false,
    super.key,
  });

  final Widget body;
  final Widget? footer;
  final bool showBackButton;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;

    return Scaffold(
      backgroundColor: colors.surfaceMuted,
      appBar: showBackButton
          ? AppBar(
              backgroundColor: Colors.transparent,
              elevation: 0,
              leading: BackButton(color: colors.textPrimary),
            )
          : null,
      body: SafeArea(
        child: ResponsiveLayout(
          maxContentWidth: 440,
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.md,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: constraints.maxHeight - AppSpacing.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      body,
                      if (footer != null) ...[
                        const Spacer(),
                        footer!,
                      ],
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
