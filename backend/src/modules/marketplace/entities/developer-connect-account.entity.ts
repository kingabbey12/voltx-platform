import { DeveloperConnectAccount, DeveloperConnectOnboardingStatus } from '@prisma/client';

export interface DeveloperConnectAccountEntity {
  id: string;
  organizationId: string;
  stripeConnectedAccountId: string;
  onboardingStatus: DeveloperConnectOnboardingStatus;
  payoutsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const toDeveloperConnectAccountEntity = (
  record: DeveloperConnectAccount,
): DeveloperConnectAccountEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  stripeConnectedAccountId: record.stripeConnectedAccountId,
  onboardingStatus: record.onboardingStatus,
  payoutsEnabled: record.payoutsEnabled,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
