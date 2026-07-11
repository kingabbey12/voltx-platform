import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { InvoiceEntity, InvoiceItemEntity, InvoiceStatus } from './entities/invoice.entity';

interface InvoiceRecord {
  id: string;
  organizationId: string;
  billingAccountId: string;
  stripeInvoiceId: string | null;
  status: InvoiceStatus;
  amountDue: { toString(): string };
  amountPaid: { toString(): string };
  amountRemaining: { toString(): string };
  currency: string;
  periodStart: Date | null;
  periodEnd: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface InvoiceItemRecord {
  id: string;
  invoiceId: string;
  featureId: string | null;
  description: string;
  amount: { toString(): string };
  quantity: number;
  createdAt: Date;
}

export interface UpsertInvoiceData {
  organizationId: string;
  billingAccountId: string;
  stripeInvoiceId: string;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  dueDate?: Date | null;
  paidAt?: Date | null;
  hostedInvoiceUrl?: string | null;
  pdfUrl?: string | null;
}

export interface CreateInvoiceItemData {
  invoiceId: string;
  featureId?: string | null;
  description: string;
  amount: number;
  quantity?: number;
}

export interface FindInvoicesParams {
  page: number;
  limit: number;
}

export interface PaginatedInvoices {
  items: InvoiceEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class InvoiceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /** Webhook-driven — creates the local mirror on first sight, updates it on every subsequent event for the same Stripe invoice. */
  async upsertByStripeInvoiceId(data: UpsertInvoiceData): Promise<InvoiceEntity> {
    const record = await this.prisma.system.invoice.upsert({
      where: { stripeInvoiceId: data.stripeInvoiceId },
      create: {
        organizationId: data.organizationId,
        billingAccountId: data.billingAccountId,
        stripeInvoiceId: data.stripeInvoiceId,
        status: data.status,
        amountDue: data.amountDue,
        amountPaid: data.amountPaid,
        amountRemaining: data.amountRemaining,
        currency: data.currency,
        periodStart: data.periodStart ?? null,
        periodEnd: data.periodEnd ?? null,
        dueDate: data.dueDate ?? null,
        paidAt: data.paidAt ?? null,
        hostedInvoiceUrl: data.hostedInvoiceUrl ?? null,
        pdfUrl: data.pdfUrl ?? null,
      },
      update: {
        status: data.status,
        amountDue: data.amountDue,
        amountPaid: data.amountPaid,
        amountRemaining: data.amountRemaining,
        paidAt: data.paidAt ?? null,
        hostedInvoiceUrl: data.hostedInvoiceUrl ?? null,
        pdfUrl: data.pdfUrl ?? null,
      },
    });
    return toEntity(record);
  }

  async addItem(data: CreateInvoiceItemData): Promise<InvoiceItemEntity> {
    const record = await this.prisma.system.invoiceItem.create({
      data: {
        invoiceId: data.invoiceId,
        featureId: data.featureId ?? null,
        description: data.description,
        amount: data.amount,
        quantity: data.quantity ?? 1,
      },
    });
    return toItemEntity(record);
  }

  async findByStripeInvoiceId(stripeInvoiceId: string): Promise<InvoiceEntity | null> {
    const record = await this.prisma.system.invoice.findUnique({ where: { stripeInvoiceId } });
    return record ? toEntity(record) : null;
  }

  async findForCurrentOrganization(params: FindInvoicesParams): Promise<PaginatedInvoices> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = { organizationId: tenant.organizationId };

    const [records, total] = await Promise.all([
      this.prisma.system.invoice.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.system.invoice.count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }
}

function toEntity(record: InvoiceRecord): InvoiceEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    billingAccountId: record.billingAccountId,
    stripeInvoiceId: record.stripeInvoiceId,
    status: record.status,
    amountDue: Number(record.amountDue),
    amountPaid: Number(record.amountPaid),
    amountRemaining: Number(record.amountRemaining),
    currency: record.currency,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    dueDate: record.dueDate,
    paidAt: record.paidAt,
    hostedInvoiceUrl: record.hostedInvoiceUrl,
    pdfUrl: record.pdfUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toItemEntity(record: InvoiceItemRecord): InvoiceItemEntity {
  return {
    id: record.id,
    invoiceId: record.invoiceId,
    featureId: record.featureId,
    description: record.description,
    amount: Number(record.amount),
    quantity: record.quantity,
    createdAt: record.createdAt,
  };
}
