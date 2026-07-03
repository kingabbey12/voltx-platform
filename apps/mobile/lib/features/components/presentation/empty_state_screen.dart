import 'package:flutter/material.dart';

import '../../../shared/widgets/empty_state.dart';

class EmptyStateScreen extends StatelessWidget {
  const EmptyStateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Empty State'),
      ),
      body: EmptyState(
        title: 'No items found',
        message: 'There is nothing to display in this section yet.',
        actionLabel: 'Refresh',
        onAction: () {},
      ),
    );
  }
}
