import 'package:flutter/material.dart';

import '../../data/models/ai_models.dart';
import 'ai_workspace_components.dart';

/// Tool execution status panel.
class ToolExecutionPanel extends StatelessWidget {
  const ToolExecutionPanel({required this.execution, super.key});

  final AiToolExecution execution;

  @override
  Widget build(BuildContext context) {
    return AiToolExecutionCard(execution: execution);
  }
}
