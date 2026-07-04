export type CompanyStatus = 'PROSPECT' | 'ACTIVE' | 'INACTIVE';

export interface CompanyEntity {
  id: string;
  organizationId: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  status: CompanyStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
