import { CompanySize, OrganizationStatus } from '@prisma/client';

export class OrganizationEntity {
  id!: string;
  name!: string;
  slug!: string;
  logoUrl!: string | null;
  email!: string | null;
  website!: string | null;
  industry!: string | null;
  country!: string | null;
  state!: string | null;
  city!: string | null;
  companySize!: CompanySize | null;
  primaryGoals!: string[];
  currency!: string | null;
  language!: string | null;
  phone!: string | null;
  timezone!: string;
  status!: OrganizationStatus;
  settings!: Record<string, unknown>;
  onboardingCompletedAt!: Date | null;
  parentOrganizationId!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
}
