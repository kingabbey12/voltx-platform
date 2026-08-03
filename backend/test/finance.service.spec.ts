import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { ExecutiveContextInvalidationService } from '../src/modules/ai/context/context.service';
import { FinanceRepository } from '../src/modules/finance/finance.repository';
import { FinanceService } from '../src/modules/finance/finance.service';

describe('FinanceService', () => {
  const transaction = {
    id: '0c1543a8-8202-4de7-82de-58a227e12d49',
    organizationId: '65c75f20-537c-4f05-9243-44ff099e4f17',
    costCenterId: null,
    type: 'EXPENSE' as const,
    status: 'POSTED' as const,
    category: 'Software',
    counterpartyName: 'Figma',
    description: null,
    amount: 249.99,
    currency: 'USD',
    occurredAt: new Date('2026-08-02T00:00:00.000Z'),
    externalReference: null,
    metadata: {},
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  };
  const budget = {
    id: 'ab82a581-7f13-4dbd-9637-2c99e865127b',
    organizationId: transaction.organizationId,
    costCenterId: null,
    name: 'Q3 operating expenses',
    category: null,
    amount: 5000,
    currency: 'USD',
    periodStart: new Date('2026-07-01T00:00:00.000Z'),
    periodEnd: new Date('2026-09-30T23:59:59.999Z'),
    createdAt: new Date('2026-08-02T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  };
  let repository: jest.Mocked<
    Pick<
      FinanceRepository,
      'hasCostCenter' | 'createTransaction' | 'createBudget' | 'findBudgetById'
    >
  >;
  let auditService: jest.Mocked<Pick<AuditService, 'record'>>;
  let service: FinanceService;

  beforeEach(() => {
    repository = {
      hasCostCenter: jest.fn(),
      createTransaction: jest.fn(),
      createBudget: jest.fn(),
      findBudgetById: jest.fn(),
    };
    auditService = { record: jest.fn() };
    service = new FinanceService(
      repository as unknown as FinanceRepository,
      auditService as unknown as AuditService,
      {
        getOrThrow: () => ({ organizationId: transaction.organizationId }),
      } as TenantContextService,
      {
        invalidateSource: jest.fn().mockResolvedValue(undefined),
      } as unknown as ExecutiveContextInvalidationService,
    );
  });

  it('records an audited transaction after verifying the cost center belongs to the tenant', async () => {
    repository.hasCostCenter.mockResolvedValue(true);
    repository.createTransaction.mockResolvedValue({
      ...transaction,
      costCenterId: 'a6e4272f-46e7-4cbb-8a1a-49550fd7c5c1',
    });

    const result = await service.createTransaction({
      type: 'EXPENSE',
      status: 'POSTED',
      category: 'Software',
      amount: 249.99,
      currency: 'USD',
      costCenterId: 'a6e4272f-46e7-4cbb-8a1a-49550fd7c5c1',
      occurredAt: transaction.occurredAt.toISOString(),
    });

    expect(repository.hasCostCenter).toHaveBeenCalledWith('a6e4272f-46e7-4cbb-8a1a-49550fd7c5c1');
    expect(repository.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 249.99, category: 'Software' }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'financial_transaction', resourceId: transaction.id }),
    );
    expect(result.amount).toBe(249.99);
  });

  it('rejects a cost center that is outside the current tenant', async () => {
    repository.hasCostCenter.mockResolvedValue(false);

    await expect(
      service.createTransaction({
        type: 'EXPENSE',
        category: 'Software',
        amount: 249.99,
        costCenterId: 'a6e4272f-46e7-4cbb-8a1a-49550fd7c5c1',
        occurredAt: transaction.occurredAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createTransaction).not.toHaveBeenCalled();
  });

  it('rejects a reversed budget period before writing a record', async () => {
    await expect(
      service.createBudget({
        name: 'Q3 operating expenses',
        amount: 5000,
        periodStart: '2026-10-01',
        periodEnd: '2026-09-30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createBudget).not.toHaveBeenCalled();
  });

  it('does not update a missing budget', async () => {
    repository.findBudgetById.mockResolvedValue(null);

    await expect(service.updateBudget(budget.id, { name: 'Revised' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
