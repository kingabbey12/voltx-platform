export interface ContactEntity {
  id: string;
  organizationId: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
