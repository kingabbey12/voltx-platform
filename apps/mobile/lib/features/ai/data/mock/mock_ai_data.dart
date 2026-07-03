import '../models/ai_models.dart';

/// Mock AI workspace data.
abstract final class MockAiData {
  static final DateTime _now = DateTime(2026, 7, 3, 9, 30);

  static const models = [
    AiModel(
      id: 'voltx-pro',
      name: 'Voltx Pro',
      description: 'Best for complex operations analysis',
      contextWindow: 128000,
      costPer1kTokens: 0.012,
    ),
    AiModel(
      id: 'voltx-fast',
      name: 'Voltx Fast',
      description: 'Quick responses for everyday tasks',
      contextWindow: 32000,
      costPer1kTokens: 0.004,
    ),
    AiModel(
      id: 'voltx-code',
      name: 'Voltx Code',
      description: 'Optimized for technical workflows',
      contextWindow: 64000,
      costPer1kTokens: 0.008,
    ),
  ];

  static const agents = [
    AiAgent(
      id: 'ops-analyst',
      name: 'Operations Analyst',
      description: 'Grid performance and demand forecasting',
      iconName: 'analytics',
      systemPrompt: 'You are an energy operations analyst.',
    ),
    AiAgent(
      id: 'maintenance',
      name: 'Maintenance Advisor',
      description: 'Equipment health and scheduling',
      iconName: 'build',
      systemPrompt: 'You advise on predictive maintenance.',
    ),
    AiAgent(
      id: 'compliance',
      name: 'Compliance Officer',
      description: 'Regulatory and audit support',
      iconName: 'shield',
      systemPrompt: 'You help with energy compliance requirements.',
    ),
  ];

  static final knowledgeBases = [
    AiKnowledgeBase(
      id: 'kb-ops',
      name: 'Operations Manual',
      description: 'SOPs, runbooks, and incident playbooks',
      documentCount: 248,
      lastSynced: _now.subtract(const Duration(hours: 2)),
    ),
    AiKnowledgeBase(
      id: 'kb-grid',
      name: 'Grid Topology',
      description: 'Network maps, substations, and capacity data',
      documentCount: 89,
      lastSynced: _now.subtract(const Duration(hours: 6)),
    ),
    AiKnowledgeBase(
      id: 'kb-reports',
      name: 'Quarterly Reports',
      description: 'Financial and performance reports',
      documentCount: 42,
      lastSynced: _now.subtract(const Duration(days: 1)),
    ),
  ];

  static const automations = [
    AiAutomation(
      id: 'auto-1',
      name: 'Daily Ops Briefing',
      description: 'Summarize overnight alerts and KPIs each morning',
      trigger: 'Schedule · 06:00',
      enabled: true,
    ),
    AiAutomation(
      id: 'auto-2',
      name: 'Peak Demand Alert',
      description: 'Analyze and recommend load shifts when threshold exceeded',
      trigger: 'Event · Demand > 90%',
      enabled: true,
    ),
    AiAutomation(
      id: 'auto-3',
      name: 'Weekly Report Draft',
      description: 'Generate draft operations report every Friday',
      trigger: 'Schedule · Friday 16:00',
      enabled: false,
    ),
  ];

  static final conversations = [
    AiConversation(
      id: 'conv-1',
      title: 'North Region peak analysis',
      preview: 'The alert was triggered at 08:42 when demand hit 94%...',
      updatedAt: _now.subtract(const Duration(minutes: 28)),
      pinned: true,
      messageCount: 6,
    ),
    AiConversation(
      id: 'conv-2',
      title: 'Turbine Cluster B inspection',
      preview: 'Schedule inspection within 72 hours based on wear signals.',
      updatedAt: _now.subtract(const Duration(hours: 3)),
      pinned: true,
      messageCount: 4,
    ),
    AiConversation(
      id: 'conv-3',
      title: 'Q3 cost optimization',
      preview: 'Shifting 8% of industrial load could save \$142K.',
      updatedAt: _now.subtract(const Duration(hours: 8)),
      pinned: false,
      messageCount: 12,
    ),
    AiConversation(
      id: 'conv-4',
      title: 'Solar farm expansion review',
      preview: 'Project Helios Phase 2 capacity projections.',
      updatedAt: _now.subtract(const Duration(days: 1)),
      pinned: false,
      messageCount: 8,
    ),
    AiConversation(
      id: 'conv-5',
      title: 'Compliance audit prep',
      preview: 'Required documentation checklist for ISO audit.',
      updatedAt: _now.subtract(const Duration(days: 2)),
      pinned: false,
      messageCount: 5,
    ),
  ];

  static const suggestedPrompts = [
    SuggestedPrompt(
      id: 'sp-1',
      label: 'Summarize today\'s alerts',
      prompt: 'Summarize all grid alerts from the last 24 hours and highlight any that need executive attention.',
      iconName: 'alert',
    ),
    SuggestedPrompt(
      id: 'sp-2',
      label: 'Draft ops briefing',
      prompt: 'Draft a morning operations briefing covering KPIs, incidents, and recommended actions.',
      iconName: 'doc',
    ),
    SuggestedPrompt(
      id: 'sp-3',
      label: 'Analyze peak demand',
      prompt: 'What caused the peak demand alert in North Region and what preventive measures do you recommend?',
      iconName: 'chart',
    ),
    SuggestedPrompt(
      id: 'sp-4',
      label: 'Review maintenance schedule',
      prompt: 'Review upcoming maintenance windows and flag any conflicts with projected peak demand.',
      iconName: 'build',
    ),
  ];

  static final initialMessages = <String, List<AiMessage>>{
    'conv-1': [
      AiMessage(
        id: 'm1',
        role: AiMessageRole.assistant,
        content:
            'Good morning. I\'ve reviewed overnight grid data. North Region had one peak demand alert at 08:42. Would you like a detailed breakdown?',
        timestamp: _now.subtract(const Duration(minutes: 35)),
      ),
      AiMessage(
        id: 'm2',
        role: AiMessageRole.user,
        content: 'What caused the peak demand alert in North Region?',
        timestamp: _now.subtract(const Duration(minutes: 30)),
      ),
      AiMessage(
        id: 'm3',
        role: AiMessageRole.assistant,
        content: '''The alert was triggered at **08:42** when demand hit **94%** of regional capacity.

## Root cause
Industrial load from **Sector 7** spiked 18% above baseline due to simultaneous equipment startup.

## Resolution
Automated load balancing resolved the event within **4 minutes**.

```json
{
  "region": "North",
  "peak_demand_mw": 1840,
  "capacity_mw": 1957,
  "utilization": 0.94
}
```

### Recommended actions
1. Review Sector 7 startup schedules
2. Enable staggered load protocol during morning shift
3. Consider demand response incentives''',
        timestamp: _now.subtract(const Duration(minutes: 28)),
      ),
    ],
  };

  static const mockResponseTemplate = '''Based on current grid data and your selected knowledge base, here is my analysis:

## Summary
Operations are within normal parameters with two optimization opportunities identified.

### Key findings
- Grid output is **12% above forecast**
- Efficiency at **94.2%** across active sites
- North Region peak resolved without manual intervention

```python
def optimize_load(region, threshold=0.90):
    demand = get_current_demand(region)
    if demand > threshold:
        return apply_demand_response(region)
    return "No action needed"
```

Let me know if you'd like me to draft an action plan or run a scenario analysis.''';
}
