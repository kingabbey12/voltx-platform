export type CommsCallDirection = 'INBOUND' | 'OUTBOUND';
export type CommsCallStatus =
  'RINGING' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'FAILED' | 'VOICEMAIL';

export interface CommsCallEntity {
  id: string;
  organizationId: string;
  conversationId: string | null;
  connectionId: string;
  direction: CommsCallDirection;
  status: CommsCallStatus;
  fromNumber: string;
  toNumber: string;
  durationSeconds: number | null;
  externalCallId: string | null;
  notes: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
}

export interface CommsCallRecordingEntity {
  id: string;
  organizationId: string;
  callId: string;
  storageUrl: string;
  durationSeconds: number | null;
  createdAt: Date;
}

export interface CommsTranscriptionEntity {
  id: string;
  organizationId: string;
  callId: string;
  text: string;
  language: string | null;
  createdAt: Date;
}
