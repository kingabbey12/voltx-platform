import 'package:flutter/material.dart';

import '../../../config/app_config.dart';
import '../../../theme/spacing.dart';
import '../../../shared/widgets/responsive_layout.dart';

/// Foundation home screen — no business logic.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text(AppConfig.appName),
      ),
      body: ResponsiveLayout(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
          children: [
            Text(
              'Welcome to Voltx',
              style: textTheme.headlineMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Your mobile foundation is ready. Explore shared components '
              'and theme settings from the navigation bar.',
              style: textTheme.bodyLarge?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            _InfoCard(
              icon: Icons.palette_outlined,
              title: 'Design System',
              description:
                  'Material 3 themes with Voltx color tokens, typography, '
                  'and spacing scale.',
            ),
            const SizedBox(height: AppSpacing.md),
            _InfoCard(
              icon: Icons.devices_outlined,
              title: 'Responsive Layout',
              description:
                  'Adaptive padding and max-width constraints for phones, '
                  'tablets, and larger screens.',
            ),
            const SizedBox(height: AppSpacing.md),
            _InfoCard(
              icon: Icons.cloud_off_outlined,
              title: 'Offline Awareness',
              description:
                  'Connectivity monitoring with a persistent offline banner.',
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.title,
    required this.description,
  });

  final IconData icon;
  final String title;
  final String description;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: colorScheme.primary),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    description,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: colorScheme.onSurfaceVariant,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
