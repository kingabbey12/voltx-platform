import 'package:flutter/material.dart';

import '../../../../theme/components/voltx_text_field.dart';
import '../../utils/auth_validators.dart';

/// Reusable password input with visibility toggle.
class AuthPasswordField extends StatelessWidget {
  const AuthPasswordField({
    required this.controller,
    required this.obscureText,
    required this.onToggleVisibility,
    this.label = 'Password',
    this.hint = 'Enter your password',
    this.helper,
    this.textInputAction = TextInputAction.done,
    this.useStrengthValidator = false,
    this.validator,
    this.onSubmitted,
    super.key,
  });

  final TextEditingController controller;
  final bool obscureText;
  final VoidCallback onToggleVisibility;
  final String label;
  final String hint;
  final String? helper;
  final TextInputAction textInputAction;
  final bool useStrengthValidator;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return VoltxTextField(
      controller: controller,
      label: label,
      hint: hint,
      helper: helper,
      obscureText: obscureText,
      textInputAction: textInputAction,
      prefixIcon: Icons.lock_outline_rounded,
      validator: validator ??
          (useStrengthValidator
              ? AuthValidators.password
              : (value) =>
                    value == null || value.isEmpty ? 'Password is required' : null),
      suffixIcon: IconButton(
        icon: Icon(
          obscureText ? Icons.visibility_outlined : Icons.visibility_off_outlined,
        ),
        onPressed: onToggleVisibility,
      ),
      onSubmitted: onSubmitted,
    );
  }
}
