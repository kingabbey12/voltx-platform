export type AttachmentStatus =
  'PENDING' | 'UPLOADING' | 'PROCESSING' | 'READY' | 'QUARANTINED' | 'FAILED';

export type AttachmentReferenceType =
  | 'AI_CONVERSATION'
  | 'AI_MESSAGE'
  | 'CRM_CONTACT'
  | 'CRM_COMPANY'
  | 'CRM_LEAD'
  | 'CRM_OPPORTUNITY'
  | 'CRM_ACTIVITY'
  | 'COMMS_MESSAGE'
  | 'PROMISE';

export interface AttachmentEntity {
  id: string;
  organizationId: string;
  uploadedBy: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  storageKey: string;
  checksumSha256: string | null;
  status: AttachmentStatus;
  scanResult: string | null;
  thumbnailKey: string | null;
  width: number | null;
  height: number | null;
  extractedText: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface AttachmentReferenceEntity {
  id: string;
  attachmentId: string;
  organizationId: string;
  referenceType: AttachmentReferenceType;
  referenceId: string;
  createdAt: Date;
}

export interface AttachmentVersionEntity {
  id: string;
  attachmentId: string;
  organizationId: string;
  versionNumber: number;
  storageKey: string;
  sizeBytes: number;
  checksumSha256: string | null;
  createdBy: string;
  createdAt: Date;
}
