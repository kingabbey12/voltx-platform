import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../dashboard/presentation/widgets/dashboard_v2_tokens.dart';
import '../../data/models/ai_models.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// Automation workflows screen.
class AiAutomationsScreen extends ConsumerWidget {
  const AiAutomationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final automations = ref.watch(automationsProvider);
    final mq = MediaQuery.sizeOf(context);
    final isDesktop = mq.width >= 1220;
    final isTablet = mq.width >= 860 && mq.width < 1220;

    if (automations.isEmpty) {
      return Column(
        children: [
          const AiNavBar(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: const [
                AiPanel(
                  highlighted: true,
                  child: AiEmptyState(
                    title: 'No Automation Workflows',
                    subtitle: 'Create or connect workflows to begin orchestrating AI operations.',
                    icon: Icons.bolt_outlined,
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final leftWidth = isDesktop ? 220.0 : (isTablet ? 180.0 : constraints.maxWidth);
              final rightWidth = isDesktop ? 300.0 : (isTablet ? 250.0 : constraints.maxWidth);

              if (isDesktop) {
                return Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        width: leftWidth,
                        child: SingleChildScrollView(
                          child: _AutomationLeftSidebar(automations: automations),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: _AutomationMainArea(
                          automations: automations,
                          scrollable: true,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      SizedBox(
                        width: rightWidth,
                        child: SingleChildScrollView(
                          child: _AutomationRightPanel(automations: automations),
                        ),
                      ),
                    ],
                  ),
                );
              }

              if (isTablet) {
                return SingleChildScrollView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _AutomationHeaderStrip(automations: automations),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: leftWidth,
                            child: _AutomationLeftSidebar(automations: automations),
                          ),
                          const SizedBox(width: AppSpacing.md),
                          Expanded(child: _AutomationMainArea(automations: automations, compact: true)),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _AutomationRightPanel(automations: automations),
                    ],
                  ),
                );
              }

              return ListView(
                padding: const EdgeInsets.all(AppSpacing.md),
                children: [
                  _AutomationHeaderStrip(automations: automations),
                  const SizedBox(height: AppSpacing.md),
                  _AutomationLeftSidebar(automations: automations, compact: true),
                  const SizedBox(height: AppSpacing.md),
                  _AutomationMainArea(automations: automations, compact: true),
                  const SizedBox(height: AppSpacing.md),
                  _AutomationRightPanel(automations: automations),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _AutomationHeaderStrip extends StatelessWidget {
  const _AutomationHeaderStrip({required this.automations});

  final List<AiAutomation> automations;

  @override
  Widget build(BuildContext context) {
    final enabled = automations.where((a) => a.enabled).length;

    return AiPanel(
      highlighted: true,
      child: Wrap(
        spacing: AppSpacing.sm,
        runSpacing: AppSpacing.sm,
        children: [
          AiSuggestionChip(label: '${automations.length} workflows', icon: Icons.account_tree_outlined),
          AiSuggestionChip(label: '$enabled running', icon: Icons.play_circle_outline_rounded),
          AiSuggestionChip(
            label: '${automations.length - enabled} scheduled',
            icon: Icons.schedule_rounded,
          ),
          AiSuggestionChip(
            label: '${_failedCount(automations)} failed',
            icon: Icons.error_outline_rounded,
            color: Colors.redAccent,
          ),
        ],
      ),
    );
  }
}

class _AutomationLeftSidebar extends StatelessWidget {
  const _AutomationLeftSidebar({required this.automations, this.compact = false});

  final List<AiAutomation> automations;
  final bool compact;

  static const _sections = [
    ('AI Agents', Icons.smart_toy_outlined),
    ('Scheduled Tasks', Icons.schedule_rounded),
    ('Workflows', Icons.account_tree_outlined),
    ('Integrations', Icons.hub_outlined),
    ('Notifications', Icons.notifications_outlined),
    ('Monitoring', Icons.monitor_heart_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    final enabled = automations.where((a) => a.enabled).length;

    return AiPanel(
      header: Text(
        'Automation Center',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (label, icon) in _sections)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: _SidebarSectionTile(
                label: label,
                icon: icon,
                selected: label == 'Workflows',
                trailing: !compact && label == 'Workflows'
                    ? AiSuggestionChip(
                        label: '$enabled',
                        icon: Icons.circle,
                      )
                    : null,
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          const AiContextCard(
            label: 'Operations Scope',
            value: 'Workflow routing, alerting, and service orchestration are currently in premium monitoring mode.',
          ),
        ],
      ),
    );
  }
}

class _AutomationMainArea extends StatelessWidget {
  const _AutomationMainArea({
    required this.automations,
    this.compact = false,
    this.scrollable = false,
  });

  final List<AiAutomation> automations;
  final bool compact;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final columns = width >= 1480
        ? 3
        : width >= 1080
            ? 2
            : 1;
    final total = automations.length;
    final running = automations.where((a) => a.enabled).length;
    final scheduled = total - running;
    final failed = _failedCount(automations);
    final successRate = _successRate(automations);

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AiPanel(
          highlighted: true,
          header: Text(
            'Executive Hero',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Automation Health is stable with proactive orchestration across AI agents, tools, and scheduled runs.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  AiSuggestionChip(label: 'Automation Health: Stable', icon: Icons.monitor_heart_outlined),
                  AiSuggestionChip(label: 'Running: $running', icon: Icons.play_circle_outline_rounded),
                  AiSuggestionChip(label: 'Scheduled: $scheduled', icon: Icons.schedule_rounded),
                  AiSuggestionChip(
                    label: 'Failed: $failed',
                    icon: Icons.error_outline_rounded,
                    color: Colors.redAccent,
                  ),
                  AiSuggestionChip(
                    label: 'Success Rate: ${(successRate * 100).toStringAsFixed(1)}%',
                    icon: Icons.insights_rounded,
                    color: Colors.green,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AiPanel(
          header: Text(
            'Workflow Grid',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: GridView.builder(
            shrinkWrap: true,
            itemCount: automations.length,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: columns,
              mainAxisSpacing: AppSpacing.sm,
              crossAxisSpacing: AppSpacing.sm,
              childAspectRatio: compact ? 1.18 : 1.28,
            ),
            itemBuilder: (context, index) => _WorkflowCard(
              automation: automations[index],
              index: index,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (compact)
          Column(
            children: [
              _ExecutionTimelinePanel(automations: automations),
              const SizedBox(height: AppSpacing.md),
              _UpcomingRunsPanel(automations: automations),
              const SizedBox(height: AppSpacing.md),
              _RecentExecutionsPanel(automations: automations),
            ],
          )
        else
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _ExecutionTimelinePanel(automations: automations)),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: _UpcomingRunsPanel(automations: automations)),
              const SizedBox(width: AppSpacing.md),
              Expanded(child: _RecentExecutionsPanel(automations: automations)),
            ],
          ),
      ],
    );

    if (!scrollable) {
      return content;
    }

    return ListView(
      children: [content],
    );
  }
}

class _SidebarSectionTile extends StatefulWidget {
  const _SidebarSectionTile({
    required this.label,
    required this.icon,
    required this.selected,
    this.trailing,
  });

  final String label;
  final IconData icon;
  final bool selected;
  final Widget? trailing;

  @override
  State<_SidebarSectionTile> createState() => _SidebarSectionTileState();
}

class _SidebarSectionTileState extends State<_SidebarSectionTile> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final selected = widget.selected;
    final borderColor = selected
        ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.42)
        : Theme.of(context).dividerColor.withValues(alpha: 0.35);
    final fillColor = selected
        ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.1)
        : _hovered
            ? Theme.of(context).colorScheme.primary.withValues(alpha: 0.06)
            : Colors.transparent;

    return MouseRegion(
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(12),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 140),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: borderColor),
              color: fillColor,
            ),
            child: Row(
              children: [
                Icon(widget.icon, size: 16),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    widget.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                  ),
                ),
                if (widget.trailing != null) widget.trailing!,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _WorkflowCard extends StatelessWidget {
  const _WorkflowCard({required this.automation, required this.index});

  final AiAutomation automation;
  final int index;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final status = _statusLabel(automation, index);
    final successRate = _workflowSuccessRate(automation, index);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(t.radiusLg),
        border: Border.all(color: t.border.withValues(alpha: 0.92)),
        gradient: LinearGradient(
          colors: [
            t.panelStrong.withValues(alpha: 0.86),
            t.panel.withValues(alpha: 0.76),
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  automation.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              AiSuggestionChip(
                label: status,
                icon: Icons.circle,
                color: _statusColor(status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Trigger: ${automation.trigger}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 2),
          Text(
            'Last Run: ${_lastRun(index)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 2),
          Text(
            'Next Run: ${_nextRun(automation, index)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 2),
          Text(
            'Runtime: ${_runtime(index)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 2),
          Text(
            'Success Rate: ${(successRate * 100).toStringAsFixed(1)}%',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'AI Summary: ${automation.description}',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _ExecutionTimelinePanel extends StatelessWidget {
  const _ExecutionTimelinePanel({required this.automations});

  final List<AiAutomation> automations;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      header: Text(
        'Execution Timeline',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      child: Column(
        children: [
          for (var i = 0; i < automations.length; i++)
            _TimelineRow(
              title: automations[i].name,
              subtitle: _statusLabel(automations[i], i),
              time: _lastRun(i),
              color: _statusColor(_statusLabel(automations[i], i)),
            ),
        ],
      ),
    );
  }
}

class _UpcomingRunsPanel extends StatelessWidget {
  const _UpcomingRunsPanel({required this.automations});

  final List<AiAutomation> automations;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      header: Text(
        'Upcoming Runs',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      child: Column(
        children: [
          for (var i = 0; i < automations.length; i++)
            _TimelineRow(
              title: automations[i].name,
              subtitle: automations[i].trigger,
              time: _nextRun(automations[i], i),
              color: Colors.lightBlueAccent,
            ),
        ],
      ),
    );
  }
}

class _RecentExecutionsPanel extends StatelessWidget {
  const _RecentExecutionsPanel({required this.automations});

  final List<AiAutomation> automations;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      header: Text(
        'Recent Executions',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      child: Column(
        children: [
          for (var i = 0; i < automations.length; i++)
            _TimelineRow(
              title: automations[i].name,
              subtitle: '${_runtime(i)} runtime',
              time: '${(_workflowSuccessRate(automations[i], i) * 100).toStringAsFixed(1)}% success',
              color: Colors.green,
            ),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.title,
    required this.subtitle,
    required this.time,
    required this.color,
  });

  final String title;
  final String subtitle;
  final String time;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: color,
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.35),
                  blurRadius: 10,
                  spreadRadius: -4,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: t.textPrimary,
                      ),
                ),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(
            time,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: t.textTertiary),
          ),
        ],
      ),
    );
  }
}

class _AutomationRightPanel extends StatelessWidget {
  const _AutomationRightPanel({required this.automations});

  final List<AiAutomation> automations;

  @override
  Widget build(BuildContext context) {
    final running = automations.where((a) => a.enabled).length;
    final queue = (automations.length * 3) + 2;

    return Column(
      children: [
        _SystemCard(
          title: 'System Health',
          value: 'Nominal',
          icon: Icons.health_and_safety_outlined,
          color: Colors.green,
        ),
        const SizedBox(height: AppSpacing.sm),
        _SystemCard(
          title: 'Tool Status',
          value: 'All tools online',
          icon: Icons.handyman_outlined,
          color: Colors.blueAccent,
        ),
        const SizedBox(height: AppSpacing.sm),
        _SystemCard(
          title: 'Queue',
          value: '$queue jobs pending',
          icon: Icons.queue_outlined,
          color: Colors.orange,
        ),
        const SizedBox(height: AppSpacing.sm),
        _SystemCard(
          title: 'Worker Status',
          value: '$running / ${automations.length} active',
          icon: Icons.precision_manufacturing_outlined,
          color: Colors.cyan,
        ),
        const SizedBox(height: AppSpacing.sm),
        _SystemCard(
          title: 'Memory Usage',
          value: '${(52 + (automations.length * 7)).clamp(0, 100)}%',
          icon: Icons.memory_outlined,
          color: Colors.deepPurpleAccent,
        ),
        const SizedBox(height: AppSpacing.sm),
        _SystemCard(
          title: 'Connected Services',
          value: '${automations.length + 4} active',
          icon: Icons.hub_outlined,
          color: Colors.teal,
        ),
      ],
    );
  }
}

class _SystemCard extends StatelessWidget {
  const _SystemCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String title;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: color),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(value, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

int _failedCount(List<AiAutomation> automations) {
  if (automations.isEmpty) {
    return 0;
  }
  return automations.where((a) => !a.enabled).length > 1 ? 1 : 0;
}

double _successRate(List<AiAutomation> automations) {
  if (automations.isEmpty) {
    return 0;
  }
  final base = automations.where((a) => a.enabled).length / automations.length;
  return (0.82 + (base * 0.17)).clamp(0, 1);
}

double _workflowSuccessRate(AiAutomation automation, int index) {
  final base = automation.enabled ? 0.92 : 0.74;
  return (base - (index * 0.03)).clamp(0.6, 0.99);
}

String _statusLabel(AiAutomation automation, int index) {
  if (!automation.enabled) {
    return index.isEven ? 'Scheduled' : 'Paused';
  }
  return index % 3 == 0 ? 'Running' : 'Healthy';
}

Color _statusColor(String status) {
  switch (status) {
    case 'Running':
      return Colors.green;
    case 'Healthy':
      return Colors.teal;
    case 'Scheduled':
      return Colors.orange;
    case 'Paused':
      return Colors.grey;
    default:
      return Colors.blueGrey;
  }
}

String _lastRun(int index) {
  const minutes = [12, 28, 45, 62, 95];
  return '${minutes[index % minutes.length]}m ago';
}

String _nextRun(AiAutomation automation, int index) {
  if (!automation.enabled) {
    return 'Awaiting manual resume';
  }
  const slots = ['In 18m', 'In 42m', 'In 1h 10m', 'In 2h 05m'];
  return slots[index % slots.length];
}

String _runtime(int index) {
  const values = ['1m 42s', '48s', '2m 14s', '3m 06s'];
  return values[index % values.length];
}
