import 'package:flutter/material.dart';

import '../../../../theme/tokens/spacing.dart';
import '../widgets/notification_center.dart';

/// Notifications screen with full notification center.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Notifications', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: AppSpacing.md),
          const NotificationCenter(),
        ],
      ),
    );
  }
}
