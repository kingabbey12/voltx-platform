import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingAccountRepository, CreateBillingAccountData } from './billing-account.repository';
import { BillingAccountEntity } from './entities/billing-account.entity';

@Injectable()
export class BillingAccountService {
  constructor(private readonly billingAccountRepository: BillingAccountRepository) {}

  async createForOrganization(data: CreateBillingAccountData): Promise<BillingAccountEntity> {
    return this.billingAccountRepository.create(data);
  }

  async getForCurrentOrganizationOrThrow(): Promise<BillingAccountEntity> {
    const account = await this.billingAccountRepository.findForCurrentOrganization();
    if (!account) {
      throw new NotFoundException('No billing account found for this organization');
    }
    return account;
  }

  async getByOrganizationIdOrThrow(organizationId: string): Promise<BillingAccountEntity> {
    const account = await this.billingAccountRepository.findByOrganizationId(organizationId);
    if (!account) {
      throw new NotFoundException(`No billing account found for organization "${organizationId}"`);
    }
    return account;
  }
}
