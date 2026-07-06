/// A role available to grant when inviting a teammate.
class OrganizationRole {
  const OrganizationRole({
    required this.id,
    required this.key,
    required this.name,
    required this.description,
  });

  factory OrganizationRole.fromJson(Map<String, dynamic> json) {
    return OrganizationRole(
      id: json['id'] as String,
      key: json['key'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
    );
  }

  final String id;
  final String key;
  final String name;
  final String? description;
}

enum InvitationStatus { pending, accepted, revoked, expired }

InvitationStatus _parseInvitationStatus(String? raw) {
  return switch (raw) {
    'ACCEPTED' => InvitationStatus.accepted,
    'REVOKED' => InvitationStatus.revoked,
    'EXPIRED' => InvitationStatus.expired,
    _ => InvitationStatus.pending,
  };
}

class Invitation {
  const Invitation({
    required this.id,
    required this.organizationId,
    required this.email,
    required this.roleId,
    required this.roleName,
    required this.status,
    required this.invitedByUserId,
    required this.invitedByName,
    required this.acceptedByUserId,
    required this.expiresAt,
    required this.acceptedAt,
    required this.revokedAt,
    required this.createdAt,
    this.invitationLink,
  });

  factory Invitation.fromJson(Map<String, dynamic> json) {
    return Invitation(
      id: json['id'] as String,
      organizationId: json['organizationId'] as String,
      email: json['email'] as String,
      roleId: json['roleId'] as String,
      roleName: json['roleName'] as String,
      status: _parseInvitationStatus(json['status'] as String?),
      invitedByUserId: json['invitedByUserId'] as String,
      invitedByName: json['invitedByName'] as String,
      acceptedByUserId: json['acceptedByUserId'] as String?,
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ?? DateTime.now(),
      acceptedAt: json['acceptedAt'] != null ? DateTime.tryParse(json['acceptedAt'] as String) : null,
      revokedAt: json['revokedAt'] != null ? DateTime.tryParse(json['revokedAt'] as String) : null,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      invitationLink: json['invitationLink'] as String?,
    );
  }

  final String id;
  final String organizationId;
  final String email;
  final String roleId;
  final String roleName;
  final InvitationStatus status;
  final String invitedByUserId;
  final String invitedByName;
  final String? acceptedByUserId;
  final DateTime expiresAt;
  final DateTime? acceptedAt;
  final DateTime? revokedAt;
  final DateTime createdAt;
  final String? invitationLink;

  bool get isExpired => status == InvitationStatus.pending && expiresAt.isBefore(DateTime.now());
}

class InvitationPreview {
  const InvitationPreview({
    required this.organizationName,
    required this.invitedByName,
    required this.email,
    required this.roleName,
    required this.status,
    required this.expiresAt,
    required this.hasExistingAccount,
  });

  factory InvitationPreview.fromJson(Map<String, dynamic> json) {
    return InvitationPreview(
      organizationName: json['organizationName'] as String,
      invitedByName: json['invitedByName'] as String,
      email: json['email'] as String,
      roleName: json['roleName'] as String,
      status: _parseInvitationStatus(json['status'] as String?),
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? '') ?? DateTime.now(),
      hasExistingAccount: json['hasExistingAccount'] as bool? ?? false,
    );
  }

  final String organizationName;
  final String invitedByName;
  final String email;
  final String roleName;
  final InvitationStatus status;
  final DateTime expiresAt;
  final bool hasExistingAccount;

  bool get isExpired => status == InvitationStatus.pending && expiresAt.isBefore(DateTime.now());
}

class InvitationPageQuery {
  const InvitationPageQuery({this.page = 1, this.limit = 20, this.status});

  final int page;
  final int limit;
  final InvitationStatus? status;

  Map<String, dynamic> toQueryParameters() {
    return {
      'page': page,
      'limit': limit,
      if (status != null) 'status': _statusToApiValue(status!),
    };
  }

  @override
  bool operator ==(Object other) {
    if (other is! InvitationPageQuery) {
      return false;
    }
    return other.page == page && other.limit == limit && other.status == status;
  }

  @override
  int get hashCode => Object.hash(page, limit, status);
}

String _statusToApiValue(InvitationStatus status) {
  return switch (status) {
    InvitationStatus.pending => 'PENDING',
    InvitationStatus.accepted => 'ACCEPTED',
    InvitationStatus.revoked => 'REVOKED',
    InvitationStatus.expired => 'EXPIRED',
  };
}

class PaginatedInvitationsResult<T> {
  const PaginatedInvitationsResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  factory PaginatedInvitationsResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) parser,
  ) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => parser(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedInvitationsResult<T>(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}
