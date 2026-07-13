enum ServiceAccountStatus {
  active,
  suspended;

  static ServiceAccountStatus fromJson(String value) =>
      ServiceAccountStatus.values.firstWhere((status) => status.name.toUpperCase() == value);
}

class ServiceAccount {
  const ServiceAccount({
    required this.id,
    required this.name,
    required this.description,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ServiceAccount.fromJson(Map<String, dynamic> json) => ServiceAccount(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        status: ServiceAccountStatus.fromJson(json['status'] as String),
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
      );

  final String id;
  final String name;
  final String? description;
  final ServiceAccountStatus status;
  final String createdAt;
  final String updatedAt;
}

class ServiceAccountToken {
  const ServiceAccountToken({
    required this.id,
    required this.name,
    required this.tokenPrefix,
    required this.expiresAt,
    required this.lastUsedAt,
    required this.revokedAt,
    required this.createdAt,
  });

  factory ServiceAccountToken.fromJson(Map<String, dynamic> json) => ServiceAccountToken(
        id: json['id'] as String,
        name: json['name'] as String,
        tokenPrefix: json['tokenPrefix'] as String,
        expiresAt: json['expiresAt'] as String?,
        lastUsedAt: json['lastUsedAt'] as String?,
        revokedAt: json['revokedAt'] as String?,
        createdAt: json['createdAt'] as String,
      );

  final String id;
  final String name;
  final String tokenPrefix;
  final String? expiresAt;
  final String? lastUsedAt;
  final String? revokedAt;
  final String createdAt;
}

class CreateServiceAccountTokenResult extends ServiceAccountToken {
  const CreateServiceAccountTokenResult({
    required super.id,
    required super.name,
    required super.tokenPrefix,
    required super.expiresAt,
    required super.lastUsedAt,
    required super.revokedAt,
    required super.createdAt,
    required this.token,
  });

  factory CreateServiceAccountTokenResult.fromJson(Map<String, dynamic> json) =>
      CreateServiceAccountTokenResult(
        id: json['id'] as String,
        name: json['name'] as String,
        tokenPrefix: json['tokenPrefix'] as String,
        expiresAt: json['expiresAt'] as String?,
        lastUsedAt: json['lastUsedAt'] as String?,
        revokedAt: json['revokedAt'] as String?,
        createdAt: json['createdAt'] as String,
        token: json['token'] as String,
      );

  /// Shown exactly once — never retrievable again.
  final String token;
}
