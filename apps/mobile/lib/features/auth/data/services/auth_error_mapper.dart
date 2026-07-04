import 'package:flutter/material.dart';

import '../../../../core/network/network_exception.dart';
import '../models/auth_user.dart';

class AuthErrorUiAction {
  const AuthErrorUiAction({required this.label, this.onPressed});

  final String label;
  final VoidCallback? onPressed;
}

class AuthErrorUiModel {
  const AuthErrorUiModel({required this.message, this.actions = const []});

  final String message;
  final List<AuthErrorUiAction> actions;
}

class AuthErrorMapper {
  const AuthErrorMapper._();

  static AuthErrorUiModel toUiModel(Object error) {
    if (error is AuthException) {
      return _mapAuthException(error);
    }

    if (error is NetworkException) {
      return _mapNetworkException(error);
    }

    return const AuthErrorUiModel(message: 'Something went wrong. Please try again.');
  }

  static AuthErrorUiModel _mapAuthException(AuthException error) {
    final code = error.code;
    if (code == 'email_exists' || code == 'conflict') {
      return _duplicateEmailState();
    }

    if (code == 'invalid_credentials') {
      return const AuthErrorUiModel(message: 'The email or password you entered is incorrect.');
    }

    return const AuthErrorUiModel(message: 'Something went wrong. Please try again.');
  }

  static AuthErrorUiModel _mapNetworkException(NetworkException error) {
    if (error.statusCode == 409) {
      return _duplicateEmailState();
    }

    if (error.statusCode == 401) {
      return const AuthErrorUiModel(message: 'The email or password you entered is incorrect.');
    }

    return const AuthErrorUiModel(message: 'Something went wrong. Please try again.');
  }

  static AuthErrorUiModel _duplicateEmailState() {
    return const AuthErrorUiModel(
      message: 'An account with this email already exists.',
      actions: [
        AuthErrorUiAction(label: 'Sign In'),
        AuthErrorUiAction(label: 'Use another email'),
      ],
    );
  }
}
