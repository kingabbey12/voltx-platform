import 'package:flutter/material.dart';

import '../../config/app_config.dart';
import '../../theme/components/voltx_motion.dart';
import '../../theme/tokens/color_tokens.dart';
import '../../theme/tokens/radius_tokens.dart';
import '../../theme/tokens/spacing.dart';

/// Full-screen loading indicator with optional message.
class LoadingScreen extends StatelessWidget {
  const LoadingScreen({
    this.message = 'Loading…',
    super.key,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      body: Center(
        child: VoltxFadeIn(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: AppSpacing.xxxl,
                  height: AppSpacing.xxxl,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: colorScheme.primary,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text(
                  message,
                  style: Theme.of(context).textTheme.bodyLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.md),
                const VoltxLoadingSkeleton(width: 180, height: 10),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Branded splash loading content used during app bootstrap.
class SplashLoadingContent extends StatelessWidget {
  const SplashLoadingContent({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return VoltxScaleIn(
      begin: 0.94,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              color: colorScheme.primary,
              borderRadius: BorderRadius.circular(RadiusTokens.lg),
              boxShadow: [
                BoxShadow(
                  color: ColorTokens.brandPrimary.withValues(alpha: 0.35),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: const Icon(
              Icons.bolt_rounded,
              color: Colors.white,
              size: 48,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            AppConfig.appName,
            style: textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            width: AppSpacing.xxxl,
            child: VoltxShimmer(
              child: LinearProgressIndicator(
                borderRadius: BorderRadius.circular(AppSpacing.xxs),
                backgroundColor: colorScheme.surfaceContainerHighest,
                color: colorScheme.primary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
