import 'package:flutter/material.dart';

import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../utils/auth_validators.dart';

/// Side-by-side first and last name fields for sign up.
class AuthNameFields extends StatelessWidget {
  const AuthNameFields({
    required this.firstNameController,
    required this.lastNameController,
    super.key,
  });

  final TextEditingController firstNameController;
  final TextEditingController lastNameController;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: VoltxTextField(
            controller: firstNameController,
            label: 'First name',
            textInputAction: TextInputAction.next,
            validator: (v) => AuthValidators.name(v, fieldLabel: 'First name'),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: VoltxTextField(
            controller: lastNameController,
            label: 'Last name',
            textInputAction: TextInputAction.next,
            validator: (v) => AuthValidators.name(v, fieldLabel: 'Last name'),
          ),
        ),
      ],
    );
  }
}
