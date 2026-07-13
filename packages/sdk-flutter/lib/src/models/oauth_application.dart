enum OAuthApplicationStatus {
  active,
  suspended;

  static OAuthApplicationStatus fromJson(String value) =>
      OAuthApplicationStatus.values.firstWhere((status) => status.name.toUpperCase() == value);
}

class OAuthApplication {
  const OAuthApplication({
    required this.id,
    required this.name,
    required this.description,
    required this.logoUrl,
    required this.clientId,
    required this.clientSecretPrefix,
    required this.scopes,
    required this.redirectUris,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  factory OAuthApplication.fromJson(Map<String, dynamic> json) => OAuthApplication(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        logoUrl: json['logoUrl'] as String?,
        clientId: json['clientId'] as String,
        clientSecretPrefix: json['clientSecretPrefix'] as String,
        scopes: List<String>.from(json['scopes'] as List),
        redirectUris: List<String>.from(json['redirectUris'] as List),
        status: OAuthApplicationStatus.fromJson(json['status'] as String),
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
      );

  final String id;
  final String name;
  final String? description;
  final String? logoUrl;
  final String clientId;
  final String clientSecretPrefix;
  final List<String> scopes;
  final List<String> redirectUris;
  final OAuthApplicationStatus status;
  final String createdAt;
  final String updatedAt;
}

class CreateOAuthApplicationResult extends OAuthApplication {
  const CreateOAuthApplicationResult({
    required super.id,
    required super.name,
    required super.description,
    required super.logoUrl,
    required super.clientId,
    required super.clientSecretPrefix,
    required super.scopes,
    required super.redirectUris,
    required super.status,
    required super.createdAt,
    required super.updatedAt,
    required this.clientSecret,
  });

  factory CreateOAuthApplicationResult.fromJson(Map<String, dynamic> json) =>
      CreateOAuthApplicationResult(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        logoUrl: json['logoUrl'] as String?,
        clientId: json['clientId'] as String,
        clientSecretPrefix: json['clientSecretPrefix'] as String,
        scopes: List<String>.from(json['scopes'] as List),
        redirectUris: List<String>.from(json['redirectUris'] as List),
        status: OAuthApplicationStatus.fromJson(json['status'] as String),
        createdAt: json['createdAt'] as String,
        updatedAt: json['updatedAt'] as String,
        clientSecret: json['clientSecret'] as String,
      );

  /// Shown exactly once — never retrievable again.
  final String clientSecret;
}

class RotateOAuthApplicationSecretResult {
  const RotateOAuthApplicationSecretResult({required this.clientSecretPrefix, required this.clientSecret});

  factory RotateOAuthApplicationSecretResult.fromJson(Map<String, dynamic> json) =>
      RotateOAuthApplicationSecretResult(
        clientSecretPrefix: json['clientSecretPrefix'] as String,
        clientSecret: json['clientSecret'] as String,
      );

  final String clientSecretPrefix;
  final String clientSecret;
}
