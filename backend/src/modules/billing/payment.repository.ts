import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { PaymentEntity, PaymentStatus } from './entities/payment.entity';

interface PaymentRecord {
  id: string;
  organizationId: string;
  invoiceId: string | null;
  paymentMethodId: string | null;
  stripePaymentIntentId: string | null;
  amount: { toString(): string };
  currency: string;
  status: PaymentStatus;
  failureCode: string | null;
  failureMessage: string | null;
  refundedAmount: { toString(): string };
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertPaymentData {
  organizationId: string;
  stripePaymentIntentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  invoiceId?: string | null;
  paymentMethodId?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

@Injectable()
export class PaymentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async upsertByStripePaymentIntentId(data: UpsertPaymentData): Promise<PaymentEntity> {
    const record = await this.prisma.system.payment.upsert({
      where: { stripePaymentIntentId: data.stripePaymentIntentId },
      create: {
        organizationId: data.organizationId,
        stripePaymentIntentId: data.stripePaymentIntentId,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        invoiceId: data.invoiceId ?? null,
        paymentMethodId: data.paymentMethodId ?? null,
        failureCode: data.failureCode ?? null,
        failureMessage: data.failureMessage ?? null,
      },
      update: {
        status: data.status,
        failureCode: data.failureCode ?? null,
        failureMessage: data.failureMessage ?? null,
      },
    });
    return toEntity(record);
  }

  async setRefundedAmount(
    id: string,
    refundedAmount: number,
    status: PaymentStatus,
  ): Promise<PaymentEntity> {
    const record = await this.prisma.system.payment.update({
      where: { id },
      data: { refundedAmount, status },
    });
    return toEntity(record);
  }

  async findByStripePaymentIntentId(stripePaymentIntentId: string): Promise<PaymentEntity | null> {
    const record = await this.prisma.system.payment.findUnique({
      where: { stripePaymentIntentId },
    });
    return record ? toEntity(record) : null;
  }

  async listForCurrentOrganization(page: number, limit: number): Promise<PaymentEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.prisma.system.payment.findMany({
      where: { organizationId: tenant.organizationId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
    });
    return records.map(toEntity);
  }
}

function toEntity(record: PaymentRecord): PaymentEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    invoiceId: record.invoiceId,
    paymentMethodId: record.paymentMethodId,
    stripePaymentIntentId: record.stripePaymentIntentId,
    amount: Number(record.amount),
    currency: record.currency,
    status: record.status,
    failureCode: record.failureCode,
    failureMessage: record.failureMessage,
    refundedAmount: Number(record.refundedAmount),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
