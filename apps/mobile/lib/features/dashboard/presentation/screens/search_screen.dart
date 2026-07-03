import 'package:flutter/material.dart';

import '../../../../theme/tokens/spacing.dart';
import '../widgets/global_search.dart';

/// Global search screen.
class SearchScreen extends StatelessWidget {
  const SearchScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Search', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: AppSpacing.md),
          const GlobalSearch(),
        ],
      ),
    );
  }
}
