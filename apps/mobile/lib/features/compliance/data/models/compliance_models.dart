class ConsentRecord {
  const ConsentRecord({
    required this.id,
    required this.userId,
    required this.consentType,
    required this.granted,
    required this.createdAt,
    this.grantedAt,
    this.revokedAt,
  });

  factory ConsentRecord.fromJson(Map<String, dynamic> json) {
    return ConsentRecord(
      id: json['id'] as String,
      userId: json['userId'] as String,
      consentType: json['consentType'] as String,
      granted: json['granted'] as bool? ?? false,
      grantedAt: json['grantedAt'] as String?,
      revokedAt: json['revokedAt'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String userId;
  final String consentType;
  final bool granted;
  final String? grantedAt;
  final String? revokedAt;
  final String createdAt;
}

class GdprExportSection {
  const GdprExportSection({required this.model, required this.label, required this.rowCount});

  factory GdprExportSection.fromJson(Map<String, dynamic> json) {
    return GdprExportSection(
      model: json['model'] as String,
      label: json['label'] as String,
      rowCount: json['rowCount'] as int? ?? 0,
    );
  }

  final String model;
  final String label;
  final int rowCount;
}

class GdprExportResult {
  const GdprExportResult({
    required this.organizationId,
    required this.userId,
    required this.exportedAt,
    required this.downloadUrl,
    required this.expiresAt,
    required this.sections,
    required this.excludedFromErasure,
  });

  factory GdprExportResult.fromJson(Map<String, dynamic> json) {
    return GdprExportResult(
      organizationId: json['organizationId'] as String,
      userId: json['userId'] as String,
      exportedAt: json['exportedAt'] as String,
      downloadUrl: json['downloadUrl'] as String,
      expiresAt: json['expiresAt'] as String,
      sections: (json['sections'] as List<dynamic>? ?? const [])
          .map((item) => GdprExportSection.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      excludedFromErasure:
          (json['excludedFromErasure'] as List<dynamic>? ?? const []).map((e) => e.toString()).toList(),
    );
  }

  final String organizationId;
  final String userId;
  final String exportedAt;
  final String downloadUrl;
  final String expiresAt;
  final List<GdprExportSection> sections;
  final List<String> excludedFromErasure;
}

class GdprErasureOutcome {
  const GdprErasureOutcome({
    required this.model,
    required this.label,
    required this.action,
    required this.affected,
    this.reason,
  });

  factory GdprErasureOutcome.fromJson(Map<String, dynamic> json) {
    return GdprErasureOutcome(
      model: json['model'] as String,
      label: json['label'] as String,
      action: json['action'] as String,
      affected: json['affected'] as int? ?? 0,
      reason: json['reason'] as String?,
    );
  }

  final String model;
  final String label;
  final String action;
  final int affected;
  final String? reason;
}

class GdprDeletionResult {
  const GdprDeletionResult({
    required this.organizationId,
    required this.userId,
    required this.results,
    required this.globalIdentityScrubbed,
  });

  factory GdprDeletionResult.fromJson(Map<String, dynamic> json) {
    return GdprDeletionResult(
      organizationId: json['organizationId'] as String,
      userId: json['userId'] as String,
      results: (json['results'] as List<dynamic>? ?? const [])
          .map((item) => GdprErasureOutcome.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      globalIdentityScrubbed: json['globalIdentityScrubbed'] as bool? ?? false,
    );
  }

  final String organizationId;
  final String userId;
  final List<GdprErasureOutcome> results;
  final bool globalIdentityScrubbed;
}

class LegalHold {
  const LegalHold({
    required this.id,
    required this.name,
    required this.reason,
    required this.status,
    required this.scope,
    required this.createdBy,
    required this.createdAt,
    this.targetUserId,
    this.releasedBy,
    this.releasedAt,
  });

  factory LegalHold.fromJson(Map<String, dynamic> json) {
    return LegalHold(
      id: json['id'] as String,
      name: json['name'] as String,
      reason: json['reason'] as String,
      targetUserId: json['targetUserId'] as String?,
      status: json['status'] as String,
      scope: Map<String, dynamic>.from(json['scope'] as Map? ?? {}),
      createdBy: json['createdBy'] as String,
      releasedBy: json['releasedBy'] as String?,
      releasedAt: json['releasedAt'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String name;
  final String reason;
  final String? targetUserId;
  final String status;
  final Map<String, dynamic> scope;
  final String createdBy;
  final String? releasedBy;
  final String? releasedAt;
  final String createdAt;
}

class AuditExport {
  const AuditExport({
    required this.id,
    required this.status,
    required this.format,
    required this.fromDate,
    required this.toDate,
    required this.createdAt,
    this.rowCount,
    this.downloadUrl,
    this.errorMessage,
  });

  factory AuditExport.fromJson(Map<String, dynamic> json) {
    return AuditExport(
      id: json['id'] as String,
      status: json['status'] as String,
      format: json['format'] as String,
      fromDate: json['fromDate'] as String,
      toDate: json['toDate'] as String,
      rowCount: json['rowCount'] as int?,
      downloadUrl: json['downloadUrl'] as String?,
      errorMessage: json['errorMessage'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String status;
  final String format;
  final String fromDate;
  final String toDate;
  final int? rowCount;
  final String? downloadUrl;
  final String? errorMessage;
  final String createdAt;
}

class AuditChainVerifyResult {
  const AuditChainVerifyResult({
    required this.valid,
    required this.checked,
    this.brokenAtIndex,
    this.brokenAuditLogId,
  });

  factory AuditChainVerifyResult.fromJson(Map<String, dynamic> json) {
    return AuditChainVerifyResult(
      valid: json['valid'] as bool? ?? false,
      checked: json['checked'] as int? ?? 0,
      brokenAtIndex: json['brokenAtIndex'] as int?,
      brokenAuditLogId: json['brokenAuditLogId'] as String?,
    );
  }

  final bool valid;
  final int checked;
  final int? brokenAtIndex;
  final String? brokenAuditLogId;
}

const List<String> retentionResourceTypes = ['AUDIT_LOG', 'CONVERSATION', 'NOTIFICATION', 'ATTACHMENT'];

class RetentionPolicy {
  const RetentionPolicy({
    required this.id,
    required this.resourceType,
    required this.retentionDays,
    required this.action,
    required this.isActive,
    required this.createdBy,
    required this.createdAt,
  });

  factory RetentionPolicy.fromJson(Map<String, dynamic> json) {
    return RetentionPolicy(
      id: json['id'] as String,
      resourceType: json['resourceType'] as String,
      retentionDays: json['retentionDays'] as int? ?? 0,
      action: json['action'] as String,
      isActive: json['isActive'] as bool? ?? true,
      createdBy: json['createdBy'] as String,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String resourceType;
  final int retentionDays;
  final String action;
  final bool isActive;
  final String createdBy;
  final String createdAt;
}
