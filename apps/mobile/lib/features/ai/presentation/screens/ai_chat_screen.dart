import 'package:flutter/material.dart';

import '../shell/ai_workspace_shell.dart';

/// Chat screen with full workspace layout.
class AiChatScreen extends StatelessWidget {
  const AiChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const AiWorkspaceShell(
      child: AiChatLayout(),
    );
  }
}
