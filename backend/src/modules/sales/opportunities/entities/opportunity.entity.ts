export type OpportunityStage =
  'DISCOVERY' | 'QUALIFICATION' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST';

export interface OpportunityEntity {
  id: string;
  organizationId: string;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  title: string;
  stage: OpportunityStage;
  amount: number | null;
  currency: string;
  probability: number;
  expectedCloseAt: Date | null;
  insights: string | null;
  nextBestAction: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
