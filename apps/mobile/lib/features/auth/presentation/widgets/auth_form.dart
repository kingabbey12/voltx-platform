import 'package:flutter/material.dart';

import 'auth_error_banner.dart';
import 'auth_form_header.dart';

/// Reusable auth form shell with header, error banner, and validation.
class AuthForm extends StatelessWidget {
  const AuthForm({
    required this.formKey,
    required this.children,
    this.title,
    this.subtitle,
    this.errorMessage = '',
    super.key,
  });

  final GlobalKey<FormState> formKey;
  final String? title;
  final String? subtitle;
  final String errorMessage;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (title != null)
            AuthFormHeader(title: title!, subtitle: subtitle),
          AuthErrorBanner(message: errorMessage),
          ...children,
        ],
      ),
    );
  }
}
