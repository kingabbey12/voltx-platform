import 'package:flutter/material.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../widgets/activity_feed.dart';
import '../widgets/ai_insights_card.dart';
import '../widgets/greeting_header.dart';
import '../widgets/kpi_cards.dart';
import '../widgets/quick_actions.dart';
import '../widgets/recent_projects.dart';

/// Executive dashboard overview screen.
class ExecutiveDashboardScreen extends StatelessWidget {
  const ExecutiveDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isWide = currentBreakpoint(context) == AppBreakpoint.expanded;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const GreetingHeader(),
          const SizedBox(height: AppSpacing.lg),
          const KpiCards(),
          const SizedBox(height: AppSpacing.lg),
          const QuickActions(),
          const SizedBox(height: AppSpacing.lg),
          if (isWide)
            const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 3, child: ActivityFeed()),
                SizedBox(width: AppSpacing.md),
                Expanded(flex: 2, child: AiInsightsCard()),
              ],
            )
          else ...[
            const ActivityFeed(),
            SizedBox(height: AppSpacing.md),
            const AiInsightsCard(),
          ],
          const SizedBox(height: AppSpacing.lg),
          const RecentProjects(),
        ],
      ),
    );
  }
}
