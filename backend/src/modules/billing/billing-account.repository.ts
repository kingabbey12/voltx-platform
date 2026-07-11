import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { BillingAccountEntity } from './entities/billing-account.entity';

interface BillingAccountRecord {
  id: string;
  organizationId: string;
  stripeCustomerId: string | null;
  email: string | null;
  defaultPaymentMethodId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBillingAccountData {
  organizationId: string;
  email?: string | null;
}

@Injectable()
export class BillingAccountRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Called at registration, before tenant context necessarily exists for
   * this brand-new organization yet — takes organizationId explicitly
   * rather than reading it from TenantContextService.
   */
  async create(data: CreateBillingAccountData): Promise<BillingAccountEntity> {
    const record = await this.prisma.system.billingAccount.create({
      data: {
        organizationId: data.organizationId,
        email: data.email ?? null,
      },
    });
    return toEntity(record);
  }

  async findByOrganizationId(organizationId: string): Promise<BillingAccountEntity | null> {
    const record = await this.prisma.system.billingAccount.findUnique({
      where: { organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findForCurrentOrganization(): Promise<BillingAccountEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.findByOrganizationId(tenant.organizationId);
  }

  async setStripeCustomerId(id: string, stripeCustomerId: string): Promise<BillingAccountEntity> {
    const record = await this.prisma.system.billingAccount.update({
      where: { id },
      data: { stripeCustomerId },
    });
    return toEntity(record);
  }

  async setDefaultPaymentMethod(
    id: string,
    defaultPaymentMethodId: string | null,
  ): Promise<BillingAccountEntity> {
    const record = await this.prisma.system.billingAccount.update({
      where: { id },
      data: { defaultPaymentMethodId },
    });
    return toEntity(record);
  }
}

function toEntity(record: BillingAccountRecord): BillingAccountEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    stripeCustomerId: record.stripeCustomerId,
    email: record.email,
    defaultPaymentMethodId: record.defaultPaymentMethodId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
