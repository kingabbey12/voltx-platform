import 'package:flutter/material.dart';

import 'components/voltx_motion.dart';
import 'extensions/voltx_colors_extension.dart';
import 'extensions/voltx_motion_extension.dart';
import 'extensions/voltx_radii_extension.dart';
import 'extensions/voltx_shadows_extension.dart';
import 'tokens/color_tokens.dart';
import 'tokens/radius_tokens.dart';
import 'tokens/spacing.dart';
import 'tokens/typography.dart';

/// Material 3 light and dark themes with Voltx design system extensions.
abstract final class AppTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isLight = brightness == Brightness.light;
    final colorScheme = isLight ? _lightColorScheme : _darkColorScheme;
    final textTheme = AppTypography.textTheme(brightness);
    final colors = isLight ? VoltxColorsExtension.light : VoltxColorsExtension.dark;
    final shadows = isLight ? VoltxShadowsExtension.light : VoltxShadowsExtension.dark;

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: colorScheme,
      textTheme: textTheme,
      scaffoldBackgroundColor: colorScheme.surface,
      canvasColor: colors.surfaceMuted,
      iconTheme: IconThemeData(color: colors.textSecondary, size: 20),
      primaryIconTheme: IconThemeData(color: colorScheme.primary),
      extensions: [
        colors,
        VoltxRadiiExtension.standard,
        shadows,
        VoltxMotionExtension.standard,
      ],
      pageTransitionsTheme: PageTransitionsTheme(
        builders: {
          for (final platform in TargetPlatform.values)
            platform: const VoltxPageTransitionsBuilder(),
        },
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        toolbarHeight: 62,
        backgroundColor: colors.surfaceElevated.withValues(alpha: isLight ? 0.9 : 0.78),
        foregroundColor: colors.textPrimary,
        surfaceTintColor: Colors.transparent,
        iconTheme: IconThemeData(color: colors.textSecondary),
        titleTextStyle: textTheme.titleLarge,
      ),
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: colors.surfaceElevated,
        indicatorColor: colorScheme.primary.withValues(alpha: isLight ? 0.14 : 0.24),
        selectedIconTheme: IconThemeData(color: colorScheme.primary, size: 22),
        unselectedIconTheme: IconThemeData(color: colors.textSecondary, size: 20),
        selectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: colorScheme.primary,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelTextStyle: textTheme.labelMedium?.copyWith(
          color: colors.textSecondary,
          fontWeight: FontWeight.w600,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 0,
        height: 68,
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        indicatorColor: colorScheme.primary.withValues(alpha: isLight ? 0.18 : 0.24),
        backgroundColor: colors.surfaceElevated.withValues(alpha: isLight ? 0.92 : 0.8),
        shadowColor: shadows.card.first.color,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          final hovered = states.contains(WidgetState.hovered);
          return textTheme.labelSmall?.copyWith(
            color: selected
                ? colorScheme.primary
                : hovered
                    ? colors.textPrimary
                    : colors.textSecondary,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          final hovered = states.contains(WidgetState.hovered);
          return IconThemeData(
            color: selected
                ? colorScheme.primary
                : hovered
                    ? colors.textPrimary
                    : colors.textSecondary,
            size: 24,
          );
        }),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colors.surfaceElevated.withValues(alpha: isLight ? 0.9 : 0.82),
        surfaceTintColor: Colors.transparent,
        shadowColor: shadows.card.first.color,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.card),
          side: BorderSide(
            color: isLight ? colors.borderSubtle.withValues(alpha: 0.9) : colorScheme.primary.withValues(alpha: 0.2),
          ),
        ),
        margin: EdgeInsets.zero,
      ),
      dividerTheme: DividerThemeData(
        color: colors.borderSubtle,
        thickness: 1,
        space: 1,
      ),
      listTileTheme: ListTileThemeData(
        dense: true,
        minLeadingWidth: 26,
        horizontalTitleGap: AppSpacing.xs,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.sm),
        ),
        iconColor: colors.textSecondary,
        textColor: colors.textPrimary,
      ),
      scrollbarTheme: ScrollbarThemeData(
        thumbVisibility: const WidgetStatePropertyAll(false),
        radius: const Radius.circular(999),
        thickness: const WidgetStatePropertyAll(7),
        thumbColor: WidgetStatePropertyAll(colors.borderStrong.withValues(alpha: 0.8)),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(Size(64, AppSpacing.buttonHeight)),
          elevation: const WidgetStatePropertyAll(0),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(RadiusTokens.md),
            ),
          ),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          shadowColor: WidgetStatePropertyAll(shadows.card.first.color),
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return Colors.white.withValues(alpha: 0.16);
            }
            if (states.contains(WidgetState.hovered)) {
              return Colors.white.withValues(alpha: 0.08);
            }
            if (states.contains(WidgetState.focused)) {
              return colorScheme.primary.withValues(alpha: 0.12);
            }
            return null;
          }),
          side: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.focused)) {
              return BorderSide(color: colorScheme.primary.withValues(alpha: 0.54), width: 1.2);
            }
            return BorderSide(color: colorScheme.primary.withValues(alpha: 0.18));
          }),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(Size(64, AppSpacing.buttonHeight)),
          side: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.focused)) {
              return BorderSide(color: colorScheme.primary, width: 1.4);
            }
            if (states.contains(WidgetState.hovered)) {
              return BorderSide(color: colors.borderStrong);
            }
            return BorderSide(color: colors.borderSubtle);
          }),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(RadiusTokens.md),
            ),
          ),
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.hovered)) {
              return colors.surfaceMuted.withValues(alpha: isLight ? 0.8 : 0.58);
            }
            return Colors.transparent;
          }),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          textStyle: WidgetStatePropertyAll(textTheme.labelLarge),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(RadiusTokens.sm),
            ),
          ),
          overlayColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.pressed)) {
              return colorScheme.primary.withValues(alpha: 0.14);
            }
            if (states.contains(WidgetState.hovered)) {
              return colorScheme.primary.withValues(alpha: 0.08);
            }
            return null;
          }),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surfaceMuted.withValues(alpha: isLight ? 0.78 : 0.62),
        hintStyle: textTheme.bodyMedium?.copyWith(color: colors.textTertiary),
        labelStyle: textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w600),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
          borderSide: BorderSide(color: colors.borderSubtle),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
          borderSide: BorderSide(color: colors.borderSubtle),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
          borderSide: BorderSide(color: colorScheme.primary, width: 1.7),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
          borderSide: BorderSide(color: colors.error),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: colors.surfaceMuted.withValues(alpha: isLight ? 0.75 : 0.6),
        selectedColor: colorScheme.primary.withValues(alpha: isLight ? 0.16 : 0.26),
        disabledColor: colors.surfaceMuted.withValues(alpha: 0.5),
        labelStyle: textTheme.labelMedium!.copyWith(fontWeight: FontWeight.w600),
        side: BorderSide(color: colors.borderSubtle),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.full),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
      ),
      dialogTheme: DialogThemeData(
        elevation: 0,
        backgroundColor: colors.surfaceElevated.withValues(alpha: isLight ? 0.92 : 0.84),
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.xl),
          side: BorderSide(color: colors.borderSubtle),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        elevation: 0,
        backgroundColor: colors.surfaceElevated.withValues(alpha: isLight ? 0.92 : 0.86),
        contentTextStyle: textTheme.bodyMedium?.copyWith(
          color: colors.textPrimary,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
          side: BorderSide(color: colors.borderSubtle),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          visualDensity: VisualDensity.compact,
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(RadiusTokens.md),
            ),
          ),
        ),
      ),
      splashFactory: InkRipple.splashFactory,
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: colorScheme.primary,
        circularTrackColor: colors.surfaceMuted,
        linearTrackColor: colors.surfaceMuted,
      ),
      textSelectionTheme: TextSelectionThemeData(
        selectionColor: colorScheme.primary.withValues(alpha: 0.24),
        selectionHandleColor: colorScheme.primary,
        cursorColor: colorScheme.primary,
      ),
      dataTableTheme: DataTableThemeData(
        dataRowMinHeight: 44,
        dataRowMaxHeight: 52,
        headingRowHeight: 46,
        headingTextStyle: textTheme.labelMedium?.copyWith(
          color: colors.textSecondary,
          fontWeight: FontWeight.w700,
        ),
        dataTextStyle: textTheme.bodySmall?.copyWith(color: colors.textPrimary),
        dividerThickness: 1,
        headingRowColor: WidgetStatePropertyAll(colors.surfaceMuted.withValues(alpha: 0.72)),
        dataRowColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return colorScheme.primary.withValues(alpha: 0.12);
          }
          if (states.contains(WidgetState.hovered)) {
            return colors.surfaceMuted.withValues(alpha: 0.66);
          }
          return null;
        }),
        decoration: BoxDecoration(
          border: Border.all(color: colors.borderSubtle),
          borderRadius: BorderRadius.circular(RadiusTokens.md),
        ),
      ),
      tooltipTheme: TooltipThemeData(
        waitDuration: const Duration(milliseconds: 450),
        showDuration: const Duration(milliseconds: 1800),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: colors.surfaceElevated,
          borderRadius: BorderRadius.circular(RadiusTokens.sm),
          border: Border.all(color: colors.borderSubtle),
          boxShadow: shadows.dropdown,
        ),
        textStyle: textTheme.bodySmall?.copyWith(color: colors.textPrimary),
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        elevation: 0,
        highlightElevation: 0,
        backgroundColor: colorScheme.primary,
        foregroundColor: colors.textInverse,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
        ),
      ),
      drawerTheme: DrawerThemeData(
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        backgroundColor: colors.surfaceElevated,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
          side: BorderSide(color: colors.borderSubtle),
        ),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        showDragHandle: true,
        elevation: 0,
        backgroundColor: colors.surfaceElevated,
        modalBackgroundColor: colors.surfaceElevated,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.xl),
          side: BorderSide(color: colors.borderSubtle),
        ),
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: colors.surfaceElevated,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(RadiusTokens.md),
          side: BorderSide(color: colors.borderSubtle),
        ),
        textStyle: textTheme.bodySmall?.copyWith(color: colors.textPrimary),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: ButtonStyle(
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(RadiusTokens.sm),
            ),
          ),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.selected) || states.contains(WidgetState.focused)) {
              return colorScheme.primary;
            }
            return colors.textSecondary;
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.hovered)) {
              return colors.surfaceMuted.withValues(alpha: 0.7);
            }
            if (states.contains(WidgetState.selected) || states.contains(WidgetState.focused)) {
              return colorScheme.primary.withValues(alpha: 0.14);
            }
            return Colors.transparent;
          }),
        ),
      ),
      visualDensity: VisualDensity.standard,
    );
  }

  static final ColorScheme _lightColorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: ColorTokens.brandPrimary,
    onPrimary: ColorTokens.neutral0,
    primaryContainer: Color(0xFFDCE5FF),
    onPrimaryContainer: ColorTokens.brandPrimaryPressed,
    secondary: ColorTokens.brandAccent,
    onSecondary: ColorTokens.neutral0,
    error: ColorTokens.error,
    onError: ColorTokens.neutral0,
    surface: ColorTokens.surfaceLight,
    onSurface: ColorTokens.neutral900,
    onSurfaceVariant: Color(0xFF596788),
    outline: ColorTokens.borderLight,
    outlineVariant: Color(0xFFD3DCF7),
    surfaceContainerHighest: Color(0xFFE9EFFF),
    surfaceContainer: Color(0xFFF2F6FF),
    surfaceContainerLow: Color(0xFFF7F9FF),
  );

  // Every value here now derives from ColorTokens' black/gold palette —
  // this previously hardcoded a second, divergent blue/purple palette
  // (e.g. primary was 0xFF86A7FF, never ColorTokens.brandPrimary) that
  // silently diverged from the rest of the design system.
  static final ColorScheme _darkColorScheme = ColorScheme(
    brightness: Brightness.dark,
    primary: ColorTokens.brandPrimary,
    onPrimary: ColorTokens.neutral950,
    primaryContainer: const Color(0xFF2E2410),
    onPrimaryContainer: ColorTokens.brandSecondary,
    secondary: ColorTokens.brandSecondary,
    onSecondary: ColorTokens.neutral950,
    error: ColorTokens.error,
    onError: ColorTokens.neutral0,
    surface: ColorTokens.surfaceDark,
    onSurface: ColorTokens.neutral50,
    onSurfaceVariant: ColorTokens.neutral400,
    outline: ColorTokens.borderDark,
    outlineVariant: ColorTokens.borderStrongDark,
    surfaceContainerHighest: const Color(0xFF1A1A1A),
    surfaceContainer: ColorTokens.surfaceElevatedDark,
    surfaceContainerLow: ColorTokens.surfaceMutedDark,
  );
}
