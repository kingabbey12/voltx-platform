class PasswordPolicy {
  const PasswordPolicy({
    required this.minLength,
    required this.requireUppercase,
    required this.requireNumber,
    required this.requireSymbol,
  });

  factory PasswordPolicy.fromJson(Map<String, dynamic> json) {
    return PasswordPolicy(
      minLength: json['minLength'] as int? ?? 8,
      requireUppercase: json['requireUppercase'] as bool? ?? false,
      requireNumber: json['requireNumber'] as bool? ?? false,
      requireSymbol: json['requireSymbol'] as bool? ?? false,
    );
  }

  final int minLength;
  final bool requireUppercase;
  final bool requireNumber;
  final bool requireSymbol;

  Map<String, dynamic> toJson() => {
        'minLength': minLength,
        'requireUppercase': requireUppercase,
        'requireNumber': requireNumber,
        'requireSymbol': requireSymbol,
      };

  PasswordPolicy copyWith({
    int? minLength,
    bool? requireUppercase,
    bool? requireNumber,
    bool? requireSymbol,
  }) {
    return PasswordPolicy(
      minLength: minLength ?? this.minLength,
      requireUppercase: requireUppercase ?? this.requireUppercase,
      requireNumber: requireNumber ?? this.requireNumber,
      requireSymbol: requireSymbol ?? this.requireSymbol,
    );
  }
}

class SecurityPolicy {
  const SecurityPolicy({
    required this.mfaRequired,
    required this.passwordPolicy,
    required this.ipAllowlist,
  });

  factory SecurityPolicy.fromJson(Map<String, dynamic> json) {
    return SecurityPolicy(
      mfaRequired: json['mfaRequired'] as bool? ?? false,
      passwordPolicy: PasswordPolicy.fromJson(
        Map<String, dynamic>.from(json['passwordPolicy'] as Map? ?? {}),
      ),
      ipAllowlist: (json['ipAllowlist'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
    );
  }

  final bool mfaRequired;
  final PasswordPolicy passwordPolicy;
  final List<String> ipAllowlist;
}

class Session {
  const Session({
    required this.id,
    required this.lastActiveAt,
    required this.createdAt,
    this.deviceFingerprint,
    this.ipAddress,
    this.userAgent,
    this.revokedAt,
  });

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      id: json['id'] as String,
      deviceFingerprint: json['deviceFingerprint'] as String?,
      ipAddress: json['ipAddress'] as String?,
      userAgent: json['userAgent'] as String?,
      lastActiveAt: json['lastActiveAt'] as String,
      createdAt: json['createdAt'] as String,
      revokedAt: json['revokedAt'] as String?,
    );
  }

  final String id;
  final String? deviceFingerprint;
  final String? ipAddress;
  final String? userAgent;
  final String lastActiveAt;
  final String createdAt;
  final String? revokedAt;
}

class PaginatedSessions {
  const PaginatedSessions({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
  });

  factory PaginatedSessions.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => Session.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedSessions(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
    );
  }

  final List<Session> items;
  final int total;
  final int page;
  final int limit;

  int get totalPages => limit == 0 ? 1 : (total / limit).ceil().clamp(1, 1 << 30);
}

class TrustedDevice {
  const TrustedDevice({
    required this.id,
    required this.trustedUntil,
    required this.lastSeenAt,
    this.label,
  });

  factory TrustedDevice.fromJson(Map<String, dynamic> json) {
    return TrustedDevice(
      id: json['id'] as String,
      label: json['label'] as String?,
      trustedUntil: json['trustedUntil'] as String,
      lastSeenAt: json['lastSeenAt'] as String,
    );
  }

  final String id;
  final String? label;
  final String trustedUntil;
  final String lastSeenAt;
}

class ApiKey {
  const ApiKey({
    required this.id,
    required this.name,
    required this.keyPrefix,
    required this.scopedPermissions,
    required this.createdAt,
    this.expiresAt,
    this.lastUsedAt,
    this.revokedAt,
  });

  factory ApiKey.fromJson(Map<String, dynamic> json) {
    return ApiKey(
      id: json['id'] as String,
      name: json['name'] as String,
      keyPrefix: json['keyPrefix'] as String,
      scopedPermissions:
          (json['scopedPermissions'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? const [],
      expiresAt: json['expiresAt'] as String?,
      lastUsedAt: json['lastUsedAt'] as String?,
      revokedAt: json['revokedAt'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String name;
  final String keyPrefix;
  final List<String> scopedPermissions;
  final String? expiresAt;
  final String? lastUsedAt;
  final String? revokedAt;
  final String createdAt;
}

class CreateApiKeyResult extends ApiKey {
  const CreateApiKeyResult({
    required super.id,
    required super.name,
    required super.keyPrefix,
    required super.scopedPermissions,
    required super.createdAt,
    required this.apiKey,
    super.expiresAt,
    super.lastUsedAt,
    super.revokedAt,
  });

  factory CreateApiKeyResult.fromJson(Map<String, dynamic> json) {
    final key = ApiKey.fromJson(json);
    return CreateApiKeyResult(
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopedPermissions: key.scopedPermissions,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      apiKey: json['apiKey'] as String,
    );
  }

  final String apiKey;
}

class MfaSetupResult {
  const MfaSetupResult({required this.secret, required this.otpauthUrl});

  factory MfaSetupResult.fromJson(Map<String, dynamic> json) {
    return MfaSetupResult(
      secret: json['secret'] as String,
      otpauthUrl: json['otpauthUrl'] as String,
    );
  }

  final String secret;
  final String otpauthUrl;
}

class MfaBackupCodesResult {
  const MfaBackupCodesResult({required this.backupCodes});

  factory MfaBackupCodesResult.fromJson(Map<String, dynamic> json) {
    return MfaBackupCodesResult(
      backupCodes: (json['backupCodes'] as List<dynamic>? ?? const []).map((e) => e.toString()).toList(),
    );
  }

  final List<String> backupCodes;
}
