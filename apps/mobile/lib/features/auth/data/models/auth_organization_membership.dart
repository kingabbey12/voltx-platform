/// A membership the authenticated user actively holds in some organization
/// — powers the organization switcher.
class AuthOrganizationMembership {
  const AuthOrganizationMembership({
    required this.organizationId,
    required this.organizationName,
    required this.organizationSlug,
    required this.roleKey,
    required this.roleName,
    required this.joinedAt,
  });

  factory AuthOrganizationMembership.fromJson(Map<String, dynamic> json) {
    return AuthOrganizationMembership(
      organizationId: json['organizationId'] as String,
      organizationName: json['organizationName'] as String,
      organizationSlug: json['organizationSlug'] as String,
      roleKey: json['roleKey'] as String,
      roleName: json['roleName'] as String,
      joinedAt: DateTime.tryParse(json['joinedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  final String organizationId;
  final String organizationName;
  final String organizationSlug;
  final String roleKey;
  final String roleName;
  final DateTime joinedAt;
}
