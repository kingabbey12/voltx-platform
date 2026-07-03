import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/conversation_list.dart';

/// Full conversation history screen.
class AiHistoryScreen extends ConsumerWidget {
  const AiHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: ConversationList(
              onSelect: (id) {
                ref.read(activeConversationIdProvider.notifier).state = id;
                context.go(AppRoutes.aiChat);
              },
            ),
          ),
        ),
      ],
    );
  }
}
