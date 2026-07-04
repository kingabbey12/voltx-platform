export type LeadStatus = 'NEW' | 'QUALIFIED' | 'NURTURING' | 'DISQUALIFIED' | 'CONVERTED';

export interface LeadEntity {
  id: string;
  organizationId: string;
  companyId: string | null;
  contactId: string | null;
  title: string;
  source: string | null;
  status: LeadStatus;
  qualificationScore: number | null;
  qualificationSummary: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
