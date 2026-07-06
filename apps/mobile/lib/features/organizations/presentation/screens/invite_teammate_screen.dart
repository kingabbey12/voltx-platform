import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/invitation_models.dart';
import '../providers/invitation_providers.dart';

/// Invite a teammate into the current organization, and manage pending
/// invitations (revoke/resend). Reachable from the profile screen; only
/// shown to sessions with `organization.invite`.
class InviteTeammateScreen extends HookConsumerWidget {
  const InviteTeammateScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    final canInvite = session?.permissions.contains('organization.invite') ?? false;
    final page = useState(1);
    final query = InvitationPageQuery(page: page.value);
    final invitations = ref.watch(invitationsProvider(query));
    final actionState = ref.watch(invitationActionControllerProvider);

    if (!canInvite) {
      return const _InviteAccessRequired();
    }

    return PullToRefresh(
      onRefresh: () async => ref.invalidate(invitationsProvider),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Invite a teammate', style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Send an invite link — there is no automatic email delivery yet, so '
              'share the link yourself once it is created.',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.voltxColors.textSecondary,
                  ),
            ),
            const SizedBox(height: AppSpacing.lg),
            VoltxCard(child: _InviteForm(actionState: actionState)),
            const SizedBox(height: AppSpacing.lg),
            Text('Invitations', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            AsyncValueView(
              value: invitations,
              onRetry: () => ref.invalidate(invitationsProvider(query)),
              isEmpty: (page) => page.items.isEmpty,
              empty: (context) => const VoltxCard(
                child: Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: Text('No invitations yet.'),
                ),
              ),
              data: (context, result) => Column(
                children: [
                  for (final invitation in result.items) ...[
                    _InvitationTile(invitation: invitation, isBusy: actionState.isLoading),
                    const SizedBox(height: AppSpacing.sm),
                  ],
                  PaginationBar(
                    page: result.page,
                    totalPages: result.totalPages,
                    onPageChanged: (p) => page.value = p,
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

class _InviteForm extends HookConsumerWidget {
  const _InviteForm({required this.actionState});

  final InvitationActionState actionState;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final emailController = useTextEditingController();
    final selectedRoleId = useState<String?>(null);
    final roles = ref.watch(invitableRolesProvider);

    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            VoltxTextField(
              controller: emailController,
              label: 'Email',
              hint: 'teammate@company.com',
              keyboardType: TextInputType.emailAddress,
              prefixIcon: Icons.mail_outline_rounded,
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Email is required';
                }
                if (!value.contains('@')) {
                  return 'Enter a valid email address';
                }
                return null;
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            roles.when(
              data: (roleList) => DropdownButtonFormField<String>(
                initialValue: selectedRoleId.value ?? (roleList.isNotEmpty ? roleList.first.id : null),
                decoration: const InputDecoration(labelText: 'Role'),
                items: [
                  for (final role in roleList)
                    DropdownMenuItem(value: role.id, child: Text(role.name)),
                ],
                onChanged: (value) => selectedRoleId.value = value,
              ),
              loading: () => const LinearProgressIndicator(),
              error: (error, _) => Text('Unable to load roles: ${AsyncValueView.friendlyMessageFor(error)}'),
            ),
            if (actionState.errorMessage != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                actionState.errorMessage!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
            if (actionState.lastLink != null) ...[
              const SizedBox(height: AppSpacing.sm),
              _InvitationLinkCard(link: actionState.lastLink!),
            ],
            const SizedBox(height: AppSpacing.md),
            VoltxButton(
              label: 'Send invite',
              isExpanded: true,
              isLoading: actionState.isLoading,
              onPressed: () async {
                final roleId = selectedRoleId.value ?? roles.valueOrNull?.firstOrNull?.id;
                if (!(formKey.currentState?.validate() ?? false) || roleId == null) {
                  return;
                }
                final success = await ref.read(invitationActionControllerProvider.notifier).invite(
                      email: emailController.text.trim(),
                      roleId: roleId,
                    );
                if (success) {
                  emailController.clear();
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _InvitationLinkCard extends StatelessWidget {
  const _InvitationLinkCard({required this.link});

  final String link;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.successSurface,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(link, style: Theme.of(context).textTheme.bodySmall, overflow: TextOverflow.ellipsis),
          ),
          IconButton(
            icon: const Icon(Icons.copy_rounded, size: 18),
            tooltip: 'Copy invite link',
            onPressed: () {
              Clipboard.setData(ClipboardData(text: link));
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Invite link copied')),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _InvitationTile extends ConsumerWidget {
  const _InvitationTile({required this.invitation, required this.isBusy});

  final Invitation invitation;
  final bool isBusy;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    return VoltxCard(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(invitation.email, style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 2),
                  Text(
                    '${invitation.roleName} · invited by ${invitation.invitedByName}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                  ),
                ],
              ),
            ),
            _StatusChip(invitation: invitation),
            if (invitation.status == InvitationStatus.pending) ...[
              IconButton(
                icon: const Icon(Icons.refresh_rounded, size: 18),
                tooltip: 'Resend',
                onPressed: isBusy
                    ? null
                    : () => ref.read(invitationActionControllerProvider.notifier).resend(invitation.id),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 18),
                tooltip: 'Revoke',
                onPressed: isBusy
                    ? null
                    : () => ref.read(invitationActionControllerProvider.notifier).revoke(invitation.id),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.invitation});

  final Invitation invitation;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final (label, color) = switch (invitation.status) {
      InvitationStatus.pending when invitation.isExpired => ('Expired', colors.warning),
      InvitationStatus.pending => ('Pending', colors.info),
      InvitationStatus.accepted => ('Accepted', colors.success),
      InvitationStatus.revoked => ('Revoked', colors.textSecondary),
      InvitationStatus.expired => ('Expired', colors.warning),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _InviteAccessRequired extends StatelessWidget {
  const _InviteAccessRequired();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: VoltxCard(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Invite permission required', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.xs),
              const Text('Ask an organization owner or admin to grant organization.invite.'),
            ],
          ),
        ),
      ),
    );
  }
}
