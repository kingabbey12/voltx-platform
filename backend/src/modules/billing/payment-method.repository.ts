import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { PaymentMethodEntity, PaymentMethodType } from './entities/payment.entity';

interface PaymentMethodRecord {
  id: string;
  organizationId: string;
  billingAccountId: string;
  stripePaymentMethodId: string;
  type: PaymentMethodType;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentMethodData {
  organizationId: string;
  billingAccountId: string;
  stripePaymentMethodId: string;
  type: PaymentMethodType;
  brand?: string | null;
  last4?: string | null;
  expMonth?: number | null;
  expYear?: number | null;
  isDefault?: boolean;
}

@Injectable()
export class PaymentMethodRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreatePaymentMethodData): Promise<PaymentMethodEntity> {
    const record = await this.prisma.system.paymentMethod.create({
      data: {
        organizationId: data.organizationId,
        billingAccountId: data.billingAccountId,
        stripePaymentMethodId: data.stripePaymentMethodId,
        type: data.type,
        brand: data.brand ?? null,
        last4: data.last4 ?? null,
        expMonth: data.expMonth ?? null,
        expYear: data.expYear ?? null,
        isDefault: data.isDefault ?? false,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<PaymentMethodEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.prisma.system.paymentMethod.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findByStripePaymentMethodId(
    stripePaymentMethodId: string,
  ): Promise<PaymentMethodEntity | null> {
    const record = await this.prisma.system.paymentMethod.findUnique({
      where: { stripePaymentMethodId },
    });
    return record ? toEntity(record) : null;
  }

  async listForCurrentOrganization(): Promise<PaymentMethodEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.prisma.system.paymentMethod.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(toEntity);
  }

  async setDefault(billingAccountId: string, id: string): Promise<PaymentMethodEntity> {
    await this.prisma.system.paymentMethod.updateMany({
      where: { billingAccountId },
      data: { isDefault: false },
    });
    const record = await this.prisma.system.paymentMethod.update({
      where: { id },
      data: { isDefault: true },
    });
    return toEntity(record);
  }

  async remove(id: string): Promise<PaymentMethodEntity> {
    const record = await this.prisma.system.paymentMethod.delete({ where: { id } });
    return toEntity(record);
  }
}

function toEntity(record: PaymentMethodRecord): PaymentMethodEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    billingAccountId: record.billingAccountId,
    stripePaymentMethodId: record.stripePaymentMethodId,
    type: record.type,
    brand: record.brand,
    last4: record.last4,
    expMonth: record.expMonth,
    expYear: record.expYear,
    isDefault: record.isDefault,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
