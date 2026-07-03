import { OrganizationStatus } from '@prisma/client';

export class OrganizationEntity {
  id!: string;
  name!: string;
  slug!: string;
  logoUrl!: string | null;
  industry!: string | null;
  country!: string | null;
  timezone!: string;
  status!: OrganizationStatus;
  settings!: Record<string, unknown>;
  createdAt!: Date;
  updatedAt!: Date;
  deletedAt!: Date | null;
}
