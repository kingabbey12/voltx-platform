import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  EXECUTIVE_CONTEXT_INVALIDATOR,
  ExecutiveContextInvalidator,
} from '../ai/context/context.types';
import { AuditService } from '../audit/audit.service';
import {
  CreateFinancialBudgetDto,
  CreateFinancialTransactionDto,
  FinanceOverviewResponseDto,
  FinancialBudgetResponseDto,
  FinancialTransactionResponseDto,
  ListFinancialTransactionsQueryDto,
  PaginatedFinancialTransactionsDto,
  UpdateFinancialBudgetDto,
  UpdateFinancialTransactionDto,
} from './dto/finance.dto';
import { FinanceRepository } from './finance.repository';

@Injectable()
export class FinanceService {
  constructor(
    private readonly financeRepository: FinanceRepository,
    private readonly auditService: AuditService,
    private readonly tenantContext: TenantContextService,
    @Inject(EXECUTIVE_CONTEXT_INVALIDATOR)
    private readonly contextInvalidation: ExecutiveContextInvalidator,
  ) {}

  async createTransaction(
    dto: CreateFinancialTransactionDto,
  ): Promise<FinancialTransactionResponseDto> {
    await this.assertCostCenter(dto.costCenterId);
    const entity = await this.financeRepository.createTransaction({
      type: dto.type,
      status: dto.status,
      category: dto.category.trim(),
      amount: dto.amount,
      currency: dto.currency,
      occurredAt: new Date(dto.occurredAt),
      costCenterId: dto.costCenterId,
      counterpartyName: dto.counterpartyName?.trim() || null,
      description: dto.description?.trim() || null,
      externalReference: dto.externalReference?.trim() || null,
    });
    await this.invalidateContext();
    await this.auditService.record({
      action: 'create',
      resource: 'financial_transaction',
      resourceId: entity.id,
      metadata: {
        type: entity.type,
        status: entity.status,
        amount: entity.amount,
        currency: entity.currency,
      },
    });
    return FinancialTransactionResponseDto.fromEntity(entity);
  }

  async findTransactions(
    query: ListFinancialTransactionsQueryDto,
  ): Promise<PaginatedFinancialTransactionsDto> {
    this.assertDateRange(query.from, query.to);
    const result = await this.financeRepository.findTransactions({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      type: query.type,
      status: query.status,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? endOfDay(query.to) : undefined,
    });
    return {
      ...result,
      items: result.items.map((item) => FinancialTransactionResponseDto.fromEntity(item)),
    };
  }

  async findTransaction(id: string): Promise<FinancialTransactionResponseDto> {
    const entity = await this.financeRepository.findTransactionById(id);
    if (!entity) throw new NotFoundException(`Financial transaction with id "${id}" not found`);
    await this.invalidateContext();
    return FinancialTransactionResponseDto.fromEntity(entity);
  }

  async updateTransaction(
    id: string,
    dto: UpdateFinancialTransactionDto,
  ): Promise<FinancialTransactionResponseDto> {
    await this.assertCostCenter(dto.costCenterId);
    const entity = await this.financeRepository.updateTransaction(id, {
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.occurredAt !== undefined ? { occurredAt: new Date(dto.occurredAt) } : {}),
      ...(dto.costCenterId !== undefined ? { costCenterId: dto.costCenterId } : {}),
      ...(dto.counterpartyName !== undefined
        ? { counterpartyName: dto.counterpartyName.trim() || null }
        : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
      ...(dto.externalReference !== undefined
        ? { externalReference: dto.externalReference.trim() || null }
        : {}),
    });
    if (!entity) throw new NotFoundException(`Financial transaction with id "${id}" not found`);
    await this.invalidateContext();
    await this.auditService.record({
      action: 'update',
      resource: 'financial_transaction',
      resourceId: id,
    });
    return FinancialTransactionResponseDto.fromEntity(entity);
  }

  async deleteTransaction(id: string): Promise<FinancialTransactionResponseDto> {
    const entity = await this.financeRepository.softDeleteTransaction(id);
    if (!entity) throw new NotFoundException(`Financial transaction with id "${id}" not found`);
    await this.auditService.record({
      action: 'delete',
      resource: 'financial_transaction',
      resourceId: id,
    });
    return FinancialTransactionResponseDto.fromEntity(entity);
  }

  async createBudget(dto: CreateFinancialBudgetDto): Promise<FinancialBudgetResponseDto> {
    this.assertBudgetPeriod(dto.periodStart, dto.periodEnd);
    await this.assertCostCenter(dto.costCenterId);
    const entity = await this.financeRepository.createBudget({
      name: dto.name.trim(),
      amount: dto.amount,
      periodStart: new Date(dto.periodStart),
      periodEnd: endOfDay(dto.periodEnd),
      category: dto.category?.trim() || null,
      currency: dto.currency,
      costCenterId: dto.costCenterId,
    });
    await this.invalidateContext();
    await this.auditService.record({
      action: 'create',
      resource: 'financial_budget',
      resourceId: entity.id,
      metadata: { amount: entity.amount, currency: entity.currency },
    });
    return FinancialBudgetResponseDto.fromEntity(entity);
  }

  async listBudgets(): Promise<FinancialBudgetResponseDto[]> {
    return (await this.financeRepository.listBudgets()).map((item) =>
      FinancialBudgetResponseDto.fromEntity(item),
    );
  }

  async updateBudget(
    id: string,
    dto: UpdateFinancialBudgetDto,
  ): Promise<FinancialBudgetResponseDto> {
    const current = await this.financeRepository.findBudgetById(id);
    if (!current) throw new NotFoundException(`Financial budget with id "${id}" not found`);
    const periodStart = dto.periodStart ?? current.periodStart.toISOString();
    const periodEnd = dto.periodEnd ?? current.periodEnd.toISOString();
    this.assertBudgetPeriod(periodStart, periodEnd);
    await this.assertCostCenter(dto.costCenterId);
    const entity = await this.financeRepository.updateBudget(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.periodStart !== undefined ? { periodStart: new Date(dto.periodStart) } : {}),
      ...(dto.periodEnd !== undefined ? { periodEnd: endOfDay(dto.periodEnd) } : {}),
      ...(dto.category !== undefined ? { category: dto.category.trim() || null } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.costCenterId !== undefined ? { costCenterId: dto.costCenterId } : {}),
    });
    if (!entity) throw new NotFoundException(`Financial budget with id "${id}" not found`);
    await this.invalidateContext();
    await this.auditService.record({
      action: 'update',
      resource: 'financial_budget',
      resourceId: id,
    });
    return FinancialBudgetResponseDto.fromEntity(entity);
  }

  async deleteBudget(id: string): Promise<FinancialBudgetResponseDto> {
    const entity = await this.financeRepository.softDeleteBudget(id);
    if (!entity) throw new NotFoundException(`Financial budget with id "${id}" not found`);
    await this.invalidateContext();
    await this.auditService.record({
      action: 'delete',
      resource: 'financial_budget',
      resourceId: id,
    });
    return FinancialBudgetResponseDto.fromEntity(entity);
  }

  async getOverview(from?: string, to?: string): Promise<FinanceOverviewResponseDto> {
    this.assertDateRange(from, to);
    const now = new Date();
    const periodStart = from
      ? new Date(from)
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = to ? endOfDay(to) : now;
    return FinanceOverviewResponseDto.fromEntity(
      await this.financeRepository.getOverview(periodStart, periodEnd),
    );
  }

  private async assertCostCenter(costCenterId?: string): Promise<void> {
    if (costCenterId && !(await this.financeRepository.hasCostCenter(costCenterId))) {
      throw new BadRequestException(
        'The supplied cost center is not available in this organization',
      );
    }
  }

  private invalidateContext(): Promise<void> {
    return this.contextInvalidation.invalidateSource(
      this.tenantContext.getOrThrow().organizationId,
      'finance',
    );
  }

  private assertBudgetPeriod(periodStart: string, periodEnd: string): void {
    if (new Date(periodStart).getTime() > new Date(periodEnd).getTime()) {
      throw new BadRequestException('Budget period end must be on or after its start');
    }
  }

  private assertDateRange(from?: string, to?: string): void {
    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      throw new BadRequestException('The end date must be on or after the start date');
    }
  }
}

function endOfDay(value: string): Date {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date;
}
