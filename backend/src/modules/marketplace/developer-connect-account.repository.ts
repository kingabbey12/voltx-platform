import { Injectable } from '@nestjs/common';
import { DeveloperConnectOnboardingStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  DeveloperConnectAccountEntity,
  toDeveloperConnectAccountEntity,
} from './entities/developer-connect-account.entity';

@Injectable()
export class DeveloperConnectAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    stripeConnectedAccountId: string,
  ): Promise<DeveloperConnectAccountEntity> {
    const record = await this.prisma.system.developerConnectAccount.create({
      data: { organizationId, stripeConnectedAccountId },
    });
    return toDeveloperConnectAccountEntity(record);
  }

  async findByOrganizationId(
    organizationId: string,
  ): Promise<DeveloperConnectAccountEntity | null> {
    const record = await this.prisma.system.developerConnectAccount.findUnique({
      where: { organizationId },
    });
    return record ? toDeveloperConnectAccountEntity(record) : null;
  }

  /** Unscoped — used only by the Connect webhook handler, which resolves
   * an account purely from the Stripe connected account id in the event. */
  async findByStripeConnectedAccountId(
    stripeConnectedAccountId: string,
  ): Promise<DeveloperConnectAccountEntity | null> {
    const record = await this.prisma.system.developerConnectAccount.findUnique({
      where: { stripeConnectedAccountId },
    });
    return record ? toDeveloperConnectAccountEntity(record) : null;
  }

  async updateStatus(
    id: string,
    onboardingStatus: DeveloperConnectOnboardingStatus,
    payoutsEnabled: boolean,
  ): Promise<DeveloperConnectAccountEntity> {
    const record = await this.prisma.system.developerConnectAccount.update({
      where: { id },
      data: { onboardingStatus, payoutsEnabled },
    });
    return toDeveloperConnectAccountEntity(record);
  }
}
