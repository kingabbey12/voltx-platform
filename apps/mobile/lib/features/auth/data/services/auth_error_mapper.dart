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
    switch (error.code) {
      case 'email_exists':
      case 'conflict':
        return _duplicateEmailState();
      case 'invalid_credentials':
        return const AuthErrorUiModel(
          message: 'The email or password you entered is incorrect.',
        );
      case 'validation_failed':
        // The backend's class-validator message is already specific and
        // accurate (e.g. "password must be longer than or equal to 8
        // characters") — surfacing it directly beats a generic message.
        return AuthErrorUiModel(
          message: error.message.isNotEmpty
              ? error.message
              : 'Please check your details and try again.',
        );
      case 'rate_limited':
        return const AuthErrorUiModel(
          message: 'Too many attempts. Please wait a minute and try again.',
        );
      case 'offline':
        return const AuthErrorUiModel(
          message: "You're offline. Check your connection and try again.",
        );
      case 'timeout':
        return const AuthErrorUiModel(
          message: 'The request timed out. Please try again.',
        );
      case 'server_error':
        return const AuthErrorUiModel(
          message: 'Our servers are having trouble right now. Please try again shortly.',
        );
      default:
        return const AuthErrorUiModel(message: 'Something went wrong. Please try again.');
    }
  }

  static AuthErrorUiModel _mapNetworkException(NetworkException error) {
    if (error.statusCode == 409) {
      return _duplicateEmailState();
    }

    if (error.statusCode == 401) {
      return const AuthErrorUiModel(message: 'The email or password you entered is incorrect.');
    }

    if (error.statusCode == 400) {
      // The backend's class-validator message is already specific and
      // accurate (e.g. "password must be longer than or equal to 8
      // characters") — surfacing it directly is more helpful here than a
      // generic "invalid input" message.
      return AuthErrorUiModel(
        message: error.message.isNotEmpty
            ? error.message
            : 'Please check your details and try again.',
      );
    }

    if (error.statusCode == 429) {
      return const AuthErrorUiModel(
        message: 'Too many attempts. Please wait a minute and try again.',
      );
    }

    switch (error.type) {
      case NetworkExceptionType.offline:
        return const AuthErrorUiModel(
          message: "You're offline. Check your connection and try again.",
        );
      case NetworkExceptionType.timeout:
        return const AuthErrorUiModel(
          message: 'The request timed out. Please try again.',
        );
      case NetworkExceptionType.server:
        return const AuthErrorUiModel(
          message: 'Our servers are having trouble right now. Please try again shortly.',
        );
      case NetworkExceptionType.cancelled:
      case NetworkExceptionType.unknown:
        return const AuthErrorUiModel(message: 'Something went wrong. Please try again.');
    }
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
