import 'package:flutter/material.dart';

import '../../../shared/widgets/loading_screen.dart';

class LoadingStateScreen extends StatelessWidget {
  const LoadingStateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const LoadingScreen(
      message: 'Fetching data…',
    );
  }
}
