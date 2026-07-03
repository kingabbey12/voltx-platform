/// Authenticated user snapshot returned by auth operations.
class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.emailVerified,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final bool emailVerified;

  String get displayName => '$firstName $lastName'.trim();
}

/// Thrown when auth operations fail in repositories.
class AuthException implements Exception {
  const AuthException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}
