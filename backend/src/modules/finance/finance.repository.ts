import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  FinancialBudgetEntity,
  FinanceOverviewEntity,
  FinancialTransactionEntity,
  FinancialTransactionStatus,
  FinancialTransactionType,
} from './entities/finance.entity';

export interface CreateFinancialTransactionData {
  type: FinancialTransactionType;
  status?: FinancialTransactionStatus;
  category: string;
  amount: number;
  currency?: string;
  occurredAt: Date;
  costCenterId?: string | null;
  counterpartyName?: string | null;
  description?: string | null;
  externalReference?: string | null;
}

export type UpdateFinancialTransactionData = Partial<CreateFinancialTransactionData>;

export interface CreateFinancialBudgetData {
  name: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  category?: string | null;
  currency?: string;
  costCenterId?: string | null;
}

export type UpdateFinancialBudgetData = Partial<CreateFinancialBudgetData>;

export interface FindFinancialTransactionsParams {
  page: number;
  limit: number;
  type?: FinancialTransactionType;
  status?: FinancialTransactionStatus;
  from?: Date;
  to?: Date;
}

@Injectable()
export class FinanceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async hasCostCenter(id: string): Promise<boolean> {
    return Boolean(await this.prisma.costCenter.findFirst({ where: { id } }));
  }

  async createTransaction(
    data: CreateFinancialTransactionData,
  ): Promise<FinancialTransactionEntity> {
    const record = await this.prisma.scoped.financialTransaction.create({
      data: {
        organizationId: this.organizationId(),
        type: data.type,
        status: data.status ?? 'POSTED',
        category: data.category,
        amount: new Prisma.Decimal(data.amount),
        currency: data.currency ?? 'USD',
        occurredAt: data.occurredAt,
        costCenterId: data.costCenterId ?? null,
        counterpartyName: data.counterpartyName ?? null,
        description: data.description ?? null,
        externalReference: data.externalReference ?? null,
      },
    });
    return toTransactionEntity(record);
  }

  async findTransactionById(id: string): Promise<FinancialTransactionEntity | null> {
    const record = await this.prisma.scoped.financialTransaction.findFirst({
      where: { id, deletedAt: null },
    });
    return record ? toTransactionEntity(record) : null;
  }

  async findTransactions(params: FindFinancialTransactionsParams): Promise<{
    items: FinancialTransactionEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const where = {
      deletedAt: null,
      ...(params.type ? { type: params.type } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.from || params.to
        ? {
            occurredAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };
    const skip = (params.page - 1) * params.limit;
    const [records, total] = await Promise.all([
      this.prisma.scoped.financialTransaction.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.scoped.financialTransaction.count({ where }),
    ]);
    return {
      items: records.map(toTransactionEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  async updateTransaction(
    id: string,
    data: UpdateFinancialTransactionData,
  ): Promise<FinancialTransactionEntity | null> {
    if (!(await this.findTransactionById(id))) return null;
    const record = await this.prisma.scoped.financialTransaction.update({
      where: { id },
      data: transactionUpdateData(data),
    });
    return toTransactionEntity(record);
  }

  async softDeleteTransaction(id: string): Promise<FinancialTransactionEntity | null> {
    if (!(await this.findTransactionById(id))) return null;
    const record = await this.prisma.scoped.financialTransaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return toTransactionEntity(record);
  }

  async createBudget(data: CreateFinancialBudgetData): Promise<FinancialBudgetEntity> {
    const record = await this.prisma.scoped.financialBudget.create({
      data: {
        organizationId: this.organizationId(),
        name: data.name,
        amount: new Prisma.Decimal(data.amount),
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        category: data.category ?? null,
        currency: data.currency ?? 'USD',
        costCenterId: data.costCenterId ?? null,
      },
    });
    return toBudgetEntity(record);
  }

  async findBudgetById(id: string): Promise<FinancialBudgetEntity | null> {
    const record = await this.prisma.scoped.financialBudget.findFirst({
      where: { id, deletedAt: null },
    });
    return record ? toBudgetEntity(record) : null;
  }

  async listBudgets(): Promise<FinancialBudgetEntity[]> {
    const records = await this.prisma.scoped.financialBudget.findMany({
      where: { deletedAt: null },
      orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    });
    return records.map(toBudgetEntity);
  }

  async updateBudget(
    id: string,
    data: UpdateFinancialBudgetData,
  ): Promise<FinancialBudgetEntity | null> {
    if (!(await this.findBudgetById(id))) return null;
    const record = await this.prisma.scoped.financialBudget.update({
      where: { id },
      data: budgetUpdateData(data),
    });
    return toBudgetEntity(record);
  }

  async softDeleteBudget(id: string): Promise<FinancialBudgetEntity | null> {
    if (!(await this.findBudgetById(id))) return null;
    const record = await this.prisma.scoped.financialBudget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return toBudgetEntity(record);
  }

  async getOverview(periodStart: Date, periodEnd: Date): Promise<FinanceOverviewEntity> {
    const inPeriod = { gte: periodStart, lte: periodEnd };
    const posted = { deletedAt: null, status: 'POSTED' as const, occurredAt: inPeriod };
    const [income, expenses, pendingExpenses, budgets] = await Promise.all([
      this.prisma.scoped.financialTransaction.aggregate({
        where: { ...posted, type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.scoped.financialTransaction.aggregate({
        where: { ...posted, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      this.prisma.scoped.financialTransaction.aggregate({
        where: { deletedAt: null, status: 'PENDING', type: 'EXPENSE', occurredAt: inPeriod },
        _sum: { amount: true },
      }),
      this.prisma.scoped.financialBudget.aggregate({
        where: {
          deletedAt: null,
          periodStart: { lte: periodEnd },
          periodEnd: { gte: periodStart },
        },
        _sum: { amount: true },
      }),
    ]);
    const incomeTotal = decimalToNumber(income._sum.amount);
    const expenseTotal = decimalToNumber(expenses._sum.amount);
    const budgetTotal = decimalToNumber(budgets._sum.amount);
    return {
      periodStart,
      periodEnd,
      currency: 'USD',
      income: incomeTotal,
      expenses: expenseTotal,
      netCashFlow: incomeTotal - expenseTotal,
      pendingExpenses: decimalToNumber(pendingExpenses._sum.amount),
      budgetedExpenses: budgetTotal,
      budgetVariance: budgetTotal - expenseTotal,
    };
  }

  private organizationId(): string {
    return this.tenantContextService.getOrThrow().organizationId;
  }
}

function transactionUpdateData(
  data: UpdateFinancialTransactionData,
): Prisma.FinancialTransactionUpdateInput {
  return {
    ...(data.type !== undefined ? { type: data.type } : {}),
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.occurredAt !== undefined ? { occurredAt: data.occurredAt } : {}),
    ...(data.costCenterId !== undefined ? { costCenterId: data.costCenterId } : {}),
    ...(data.counterpartyName !== undefined ? { counterpartyName: data.counterpartyName } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.externalReference !== undefined ? { externalReference: data.externalReference } : {}),
  };
}

function budgetUpdateData(data: UpdateFinancialBudgetData): Prisma.FinancialBudgetUpdateInput {
  return {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.amount !== undefined ? { amount: new Prisma.Decimal(data.amount) } : {}),
    ...(data.periodStart !== undefined ? { periodStart: data.periodStart } : {}),
    ...(data.periodEnd !== undefined ? { periodEnd: data.periodEnd } : {}),
    ...(data.category !== undefined ? { category: data.category } : {}),
    ...(data.currency !== undefined ? { currency: data.currency } : {}),
    ...(data.costCenterId !== undefined ? { costCenterId: data.costCenterId } : {}),
  };
}

function toTransactionEntity(record: {
  id: string;
  organizationId: string;
  costCenterId: string | null;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  category: string;
  counterpartyName: string | null;
  description: string | null;
  amount: Prisma.Decimal;
  currency: string;
  occurredAt: Date;
  externalReference: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): FinancialTransactionEntity {
  return {
    ...record,
    amount: decimalToNumber(record.amount),
    metadata: jsonObject(record.metadata),
  };
}

function toBudgetEntity(record: {
  id: string;
  organizationId: string;
  costCenterId: string | null;
  name: string;
  category: string | null;
  amount: Prisma.Decimal;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}): FinancialBudgetEntity {
  return { ...record, amount: decimalToNumber(record.amount) };
}

function decimalToNumber(value: Prisma.Decimal | null): number {
  return value ? value.toNumber() : 0;
}

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
