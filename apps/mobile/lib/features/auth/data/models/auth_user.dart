/// Authenticated user snapshot returned by auth operations.
class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.emailVerified,
    this.organizationId,
    this.roles = const [],
    this.permissions = const [],
    this.avatarUrl,
    this.onboardingCompleted = false,
    this.mfaEnabled = false,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      emailVerified: json['emailVerifiedAt'] != null,
      organizationId: json['organizationId'] as String?,
      roles: (json['roles'] as List<dynamic>?)
              ?.map((role) => role.toString())
              .toList() ??
          const [],
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((permission) => permission.toString())
              .toList() ??
          const [],
      avatarUrl: json['avatarUrl'] as String?,
      onboardingCompleted: json['onboardingCompleted'] as bool? ?? false,
      mfaEnabled: json['mfaEnabled'] as bool? ?? false,
    );
  }

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final bool emailVerified;
  final String? organizationId;
  final List<String> roles;
  final List<String> permissions;
  final String? avatarUrl;
  final bool onboardingCompleted;
  final bool mfaEnabled;

  String get displayName => '$firstName $lastName'.trim();

  AuthUser copyWith({
    bool? emailVerified,
    String? organizationId,
    List<String>? roles,
    List<String>? permissions,
    String? avatarUrl,
    String? firstName,
    String? lastName,
    bool? onboardingCompleted,
    bool? mfaEnabled,
  }) {
    return AuthUser(
      id: id,
      email: email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      emailVerified: emailVerified ?? this.emailVerified,
      organizationId: organizationId ?? this.organizationId,
      roles: roles ?? this.roles,
      permissions: permissions ?? this.permissions,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      onboardingCompleted: onboardingCompleted ?? this.onboardingCompleted,
      mfaEnabled: mfaEnabled ?? this.mfaEnabled,
    );
  }
}

/// Thrown when auth operations fail in repositories.
class AuthException implements Exception {
  const AuthException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}
