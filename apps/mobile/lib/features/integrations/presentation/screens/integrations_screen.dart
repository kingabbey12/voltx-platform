import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../ai/presentation/shell/ai_nav_bar.dart';
import '../../../ai/presentation/widgets/ai_workspace_components.dart';
import '../../data/models/integration_models.dart';
import '../providers/integration_providers.dart';

/// Enterprise Integration Platform (VT-025) admin screen — connect,
/// health-check, sync, refresh, and revoke real external system
/// connections (Stripe, generic webhooks/REST, and — pending an OAuth
/// redirect target this app doesn't host yet — Google/Microsoft/Slack/
/// Teams/GitHub).
class IntegrationsScreen extends ConsumerWidget {
  const IntegrationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(_pageProvider);
    final provider = ref.watch(integrationProviderFilterProvider);
    final connections = ref.watch(
      integrationConnectionsProvider(IntegrationPageQuery(page: page, limit: 20, provider: provider)),
    );
    final actionState = ref.watch(integrationActionControllerProvider);

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(integrationConnectionsProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                AiPanel(
                  highlighted: true,
                  header: Row(
                    children: [
                      Text(
                        'Integrations',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: () => _showConnectDialog(context, ref),
                        icon: const Icon(Icons.add_link_rounded, size: 18),
                        label: const Text('Connect'),
                      ),
                    ],
                  ),
                  child: Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      FilterChip(
                        label: const Text('All providers'),
                        selected: provider == null,
                        onSelected: (_) => ref.read(integrationProviderFilterProvider.notifier).state = null,
                      ),
                      for (final key in integrationProviderKeys)
                        FilterChip(
                          label: Text(_providerLabel(key)),
                          selected: provider == key,
                          onSelected: (_) => ref.read(integrationProviderFilterProvider.notifier).state = key,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (actionState.errorMessage != null) ...[
                  InlineErrorCard(message: actionState.errorMessage!),
                  const SizedBox(height: AppSpacing.md),
                ],
                AsyncValueView<PaginatedIntegrationResult<IntegrationConnection>>(
                  value: connections,
                  onRetry: () => ref.invalidate(integrationConnectionsProvider),
                  isEmpty: (result) => result.items.isEmpty,
                  empty: (context) => const AiEmptyState(
                    title: 'No integrations connected',
                    subtitle: 'Connect Stripe, a webhook, or a REST API to start automating with real data.',
                    icon: Icons.hub_outlined,
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final connection in result.items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _ConnectionCard(connection: connection, isLoading: actionState.isLoading),
                        ),
                      PaginationBar(
                        page: result.page,
                        totalPages: result.totalPages,
                        onPageChanged: (p) => ref.read(_pageProvider.notifier).state = p,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  static void _showConnectDialog(BuildContext context, WidgetRef ref) {
    showDialog<void>(
      context: context,
      builder: (context) => const _ConnectDialog(),
    );
  }

  static String _providerLabel(String key) {
    return key.split('_').map((part) => part.isEmpty ? part : '${part[0]}${part.substring(1).toLowerCase()}').join(' ');
  }
}

final _pageProvider = StateProvider<int>((ref) => 1);

class _ConnectionCard extends ConsumerWidget {
  const _ConnectionCard({required this.connection, required this.isLoading});

  final IntegrationConnection connection;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metrics = ref.watch(integrationMetricsProvider(connection.id));
    final controller = ref.read(integrationActionControllerProvider.notifier);

    return AiPanel(
      highlighted: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      connection.displayName,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    Text(connection.provider, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              AiSuggestionChip(label: connection.status, icon: Icons.circle, color: _statusColor(context, connection.status)),
            ],
          ),
          if (connection.lastError != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              connection.lastError!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.error),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(child: AiContextCard(label: 'Health', value: connection.lastHealthStatus)),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: AiContextCard(
                  label: 'Last Sync',
                  value: connection.lastSyncAt == null ? 'never' : _relative(connection.lastSyncAt!),
                ),
              ),
            ],
          ),
          metrics.maybeWhen(
            data: (result) => Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(child: AiContextCard(label: 'API Calls', value: '${result.totalCalls}')),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(child: AiContextCard(label: 'Failed Calls', value: '${result.failedCalls}')),
                ],
              ),
            ),
            orElse: () => const SizedBox.shrink(),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              OutlinedButton.icon(
                onPressed: isLoading ? null : () => controller.checkHealth(connection.id),
                icon: const Icon(Icons.health_and_safety_outlined, size: 16),
                label: const Text('Health check'),
              ),
              OutlinedButton.icon(
                onPressed: isLoading ? null : () => controller.sync(connection.id),
                icon: const Icon(Icons.sync_rounded, size: 16),
                label: const Text('Sync'),
              ),
              if (connection.authType == 'OAUTH2')
                OutlinedButton.icon(
                  onPressed: isLoading ? null : () => controller.refreshToken(connection.id),
                  icon: const Icon(Icons.refresh_rounded, size: 16),
                  label: const Text('Refresh token'),
                ),
              OutlinedButton.icon(
                onPressed: isLoading ? null : () => _confirmDelete(context, ref, connection.id),
                icon: const Icon(Icons.link_off_rounded, size: 16),
                label: const Text('Delete'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static Future<void> _confirmDelete(BuildContext context, WidgetRef ref, String id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete connection?'),
        content: const Text('This disconnects the integration and removes its stored credential.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(integrationActionControllerProvider.notifier).delete(id);
    }
  }

  Color _statusColor(BuildContext context, String status) {
    final colors = context.voltxColors;
    return switch (status) {
      'CONNECTED' => colors.success,
      'ERROR' => colors.error,
      'PENDING' => colors.warning,
      _ => colors.textTertiary,
    };
  }

  String _relative(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) {
      return iso;
    }
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }
}

class _ConnectDialog extends ConsumerStatefulWidget {
  const _ConnectDialog();

  @override
  ConsumerState<_ConnectDialog> createState() => _ConnectDialogState();
}

class _ConnectDialogState extends ConsumerState<_ConnectDialog> {
  String _provider = apiKeyProviderKeys.first;
  final _nameController = TextEditingController();
  final _apiKeyController = TextEditingController();
  final _webhookSecretController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _apiKeyController.dispose();
    _webhookSecretController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Connect an integration'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'OAuth providers (Google, Microsoft, Slack, Teams, GitHub) require a web redirect '
              'and can be connected from the Voltx web app. This form covers API-key-based providers.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.md),
            DropdownButtonFormField<String>(
              initialValue: _provider,
              decoration: const InputDecoration(labelText: 'Provider'),
              items: [
                for (final key in apiKeyProviderKeys) DropdownMenuItem(value: key, child: Text(key)),
              ],
              onChanged: (value) => setState(() => _provider = value ?? _provider),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Display name'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _apiKeyController,
              decoration: const InputDecoration(labelText: 'API key (optional)'),
              obscureText: true,
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _webhookSecretController,
              decoration: const InputDecoration(labelText: 'Webhook secret (optional)'),
              obscureText: true,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.error,
                    ),
              ),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Connect'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = 'Display name is required');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final success = await ref.read(integrationActionControllerProvider.notifier).connect(
          provider: _provider,
          displayName: _nameController.text.trim(),
          apiKey: _apiKeyController.text,
          webhookSecret: _webhookSecretController.text,
        );
    if (!mounted) {
      return;
    }
    if (success) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _submitting = false;
        _error = ref.read(integrationActionControllerProvider).errorMessage;
      });
    }
  }
}
