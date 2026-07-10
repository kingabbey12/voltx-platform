/// Server-side attachment status — mirrors backend's AttachmentStatus enum.
enum AttachmentStatus { pending, uploading, processing, ready, quarantined, failed }

AttachmentStatus attachmentStatusFromJson(String value) {
  switch (value) {
    case 'PENDING':
      return AttachmentStatus.pending;
    case 'UPLOADING':
      return AttachmentStatus.uploading;
    case 'PROCESSING':
      return AttachmentStatus.processing;
    case 'READY':
      return AttachmentStatus.ready;
    case 'QUARANTINED':
      return AttachmentStatus.quarantined;
    case 'FAILED':
      return AttachmentStatus.failed;
    default:
      return AttachmentStatus.failed;
  }
}

/// A real, uploaded-and-persisted attachment, as returned by the backend
/// attachments API. Distinct from [PendingAttachmentUpload], which tracks
/// client-side upload progress before the file has finished processing.
class RemoteAttachment {
  const RemoteAttachment({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.status,
    required this.hasThumbnail,
    this.width,
    this.height,
  });

  factory RemoteAttachment.fromJson(Map<String, dynamic> json) {
    return RemoteAttachment(
      id: json['id'] as String,
      fileName: json['fileName'] as String,
      mimeType: json['mimeType'] as String,
      sizeBytes: json['sizeBytes'] as int,
      status: attachmentStatusFromJson(json['status'] as String),
      hasThumbnail: json['hasThumbnail'] as bool? ?? false,
      width: json['width'] as int?,
      height: json['height'] as int?,
    );
  }

  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final AttachmentStatus status;
  final bool hasThumbnail;
  final int? width;
  final int? height;

  bool get isImage => mimeType.startsWith('image/');
}

enum AttachmentReferenceType {
  aiConversation,
  aiMessage,
  crmContact,
  crmCompany,
  crmLead,
  crmOpportunity,
  crmActivity,
  commsMessage,
}

extension AttachmentReferenceTypeWire on AttachmentReferenceType {
  String get wireValue {
    switch (this) {
      case AttachmentReferenceType.aiConversation:
        return 'AI_CONVERSATION';
      case AttachmentReferenceType.aiMessage:
        return 'AI_MESSAGE';
      case AttachmentReferenceType.crmContact:
        return 'CRM_CONTACT';
      case AttachmentReferenceType.crmCompany:
        return 'CRM_COMPANY';
      case AttachmentReferenceType.crmLead:
        return 'CRM_LEAD';
      case AttachmentReferenceType.crmOpportunity:
        return 'CRM_OPPORTUNITY';
      case AttachmentReferenceType.crmActivity:
        return 'CRM_ACTIVITY';
      case AttachmentReferenceType.commsMessage:
        return 'COMMS_MESSAGE';
    }
  }
}
