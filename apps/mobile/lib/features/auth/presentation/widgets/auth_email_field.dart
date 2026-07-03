import 'package:flutter/material.dart';

import '../../../../theme/components/voltx_text_field.dart';
import '../../utils/auth_validators.dart';

/// Reusable email input for auth forms.
class AuthEmailField extends StatelessWidget {
  const AuthEmailField({
    required this.controller,
    this.label = 'Email',
    this.hint = 'name@company.com',
    this.textInputAction = TextInputAction.next,
    this.onSubmitted,
    super.key,
  });

  final TextEditingController controller;
  final String label;
  final String hint;
  final TextInputAction textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return VoltxTextField(
      controller: controller,
      label: label,
      hint: hint,
      keyboardType: TextInputType.emailAddress,
      textInputAction: textInputAction,
      prefixIcon: Icons.mail_outline_rounded,
      validator: AuthValidators.email,
      onSubmitted: onSubmitted,
    );
  }
}
