import { InvitationStatus } from '@prisma/client';

export class InvitationEntity {
  id!: string;
  organizationId!: string;
  email!: string;
  roleId!: string;
  roleName!: string;
  status!: InvitationStatus;
  invitedByUserId!: string;
  invitedByName!: string;
  acceptedByUserId!: string | null;
  expiresAt!: Date;
  acceptedAt!: Date | null;
  revokedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class InvitationPreviewEntity {
  organizationName!: string;
  invitedByName!: string;
  email!: string;
  roleName!: string;
  status!: InvitationStatus;
  expiresAt!: Date;
  /** Whether a user account with this email already exists (accept flow skips password/name fields). */
  hasExistingAccount!: boolean;
}
