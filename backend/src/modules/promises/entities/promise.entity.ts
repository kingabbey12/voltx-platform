export type PromiseStatus = 'PROPOSED' | 'STANDING' | 'FULFILLED' | 'RELEASED' | 'BROKEN';

export type PromisePartyRole = 'OBLIGOR' | 'OBLIGEE';

export type PromiseEventType = 'CREATED' | 'STATUS_CHANGED' | 'AI_RECOMMENDATION' | 'NOTE_ADDED';

export interface PromisePartyEntity {
  id: string;
  promiseId: string;
  role: PromisePartyRole;
  contactId: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface PromiseEventEntity {
  id: string;
  promiseId: string;
  type: PromiseEventType;
  actorId: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface PromiseEntity {
  id: string;
  organizationId: string;
  title: string;
  status: PromiseStatus;
  ownerId: string;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  parties: PromisePartyEntity[];
}
