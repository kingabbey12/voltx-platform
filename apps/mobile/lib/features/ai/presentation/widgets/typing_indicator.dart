import 'package:flutter/material.dart';

import 'ai_workspace_components.dart';

/// Token usage indicator bar.
class TokenUsageIndicator extends StatelessWidget {
  const TokenUsageIndicator({
    required this.tokensUsed,
    required this.contextWindow,
    super.key,
  });

  final int tokensUsed;
  final int contextWindow;

  @override
  Widget build(BuildContext context) {
    return AiContextCard(
      label: 'Token usage',
      value: '${_format(tokensUsed)} / ${_format(contextWindow)}',
      trailing: SizedBox(
        width: 76,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: (tokensUsed / contextWindow).clamp(0.0, 1.0),
            minHeight: 6,
          ),
        ),
      ),
    );
  }

  String _format(int n) {
    if (n >= 1000) {
      return '${(n / 1000).toStringAsFixed(1)}K';
    }
    return '$n';
  }
}
