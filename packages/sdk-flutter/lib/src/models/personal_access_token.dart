/// User-scoped bearer token (see PersonalAccessTokenGuard) — not bound to
/// one organization.
class PersonalAccessToken {
  const PersonalAccessToken({
    required this.id,
    required this.name,
    required this.tokenPrefix,
    required this.scopedPermissions,
    required this.expiresAt,
    required this.lastUsedAt,
    required this.revokedAt,
    required this.createdAt,
  });

  factory PersonalAccessToken.fromJson(Map<String, dynamic> json) => PersonalAccessToken(
        id: json['id'] as String,
        name: json['name'] as String,
        tokenPrefix: json['tokenPrefix'] as String,
        scopedPermissions: List<String>.from(json['scopedPermissions'] as List),
        expiresAt: json['expiresAt'] as String?,
        lastUsedAt: json['lastUsedAt'] as String?,
        revokedAt: json['revokedAt'] as String?,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String name;
  final String tokenPrefix;
  final List<String> scopedPermissions;
  final String? expiresAt;
  final String? lastUsedAt;
  final String? revokedAt;
  final String createdAt;
}

class CreatePersonalAccessTokenResult extends PersonalAccessToken {
  const CreatePersonalAccessTokenResult({
    required super.id,
    required super.name,
    required super.tokenPrefix,
    required super.scopedPermissions,
    required super.expiresAt,
    required super.lastUsedAt,
    required super.revokedAt,
    required super.createdAt,
    required this.token,
  });

  factory CreatePersonalAccessTokenResult.fromJson(Map<String, dynamic> json) =>
      CreatePersonalAccessTokenResult(
        id: json['id'] as String,
        name: json['name'] as String,
        tokenPrefix: json['tokenPrefix'] as String,
        scopedPermissions: List<String>.from(json['scopedPermissions'] as List),
        expiresAt: json['expiresAt'] as String?,
        lastUsedAt: json['lastUsedAt'] as String?,
        revokedAt: json['revokedAt'] as String?,
        createdAt: json['createdAt'] as String,
        token: json['token'] as String,
      );

  /// Shown exactly once — never retrievable again.
  final String token;
}
