import 'package:flutter/material.dart';

/// Breakpoint definitions for responsive layouts.
enum AppBreakpoint {
  compact(maxWidth: 600),
  medium(maxWidth: 1024),
  expanded(maxWidth: double.infinity);

  const AppBreakpoint({required this.maxWidth});

  final double maxWidth;

  static AppBreakpoint fromWidth(double width) {
    if (width < compact.maxWidth) {
      return AppBreakpoint.compact;
    }
    if (width < medium.maxWidth) {
      return AppBreakpoint.medium;
    }
    return AppBreakpoint.expanded;
  }
}

/// Constrains content width and adapts padding for different screen sizes.
class ResponsiveLayout extends StatelessWidget {
  const ResponsiveLayout({
    required this.child,
    this.compactPadding,
    this.mediumPadding,
    this.expandedPadding,
    this.maxContentWidth = 960,
    super.key,
  });

  final Widget child;
  final EdgeInsets? compactPadding;
  final EdgeInsets? mediumPadding;
  final EdgeInsets? expandedPadding;
  final double maxContentWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final breakpoint = AppBreakpoint.fromWidth(constraints.maxWidth);
        final padding = switch (breakpoint) {
          AppBreakpoint.compact =>
            compactPadding ?? const EdgeInsets.symmetric(horizontal: 16),
          AppBreakpoint.medium =>
            mediumPadding ?? const EdgeInsets.symmetric(horizontal: 24),
          AppBreakpoint.expanded =>
            expandedPadding ?? const EdgeInsets.symmetric(horizontal: 32),
        };

        return Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxContentWidth),
            child: Padding(
              padding: padding,
              child: child,
            ),
          ),
        );
      },
    );
  }
}

/// Returns the current breakpoint from the nearest [MediaQuery].
AppBreakpoint currentBreakpoint(BuildContext context) {
  return AppBreakpoint.fromWidth(MediaQuery.sizeOf(context).width);
}
