import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/error_screen.dart';

class ErrorStateScreen extends StatelessWidget {
  const ErrorStateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ErrorScreen(
      title: 'Unable to load content',
      message: 'We could not complete your request. Check your connection '
          'and try again.',
      onRetry: () => context.pop(),
    );
  }
}
