export type FinancialTransactionType = 'INCOME' | 'EXPENSE';
export type FinancialTransactionStatus = 'PENDING' | 'POSTED' | 'VOID';

export interface FinancialTransactionEntity {
  id: string;
  organizationId: string;
  costCenterId: string | null;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  category: string;
  counterpartyName: string | null;
  description: string | null;
  amount: number;
  currency: string;
  occurredAt: Date;
  externalReference: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinancialBudgetEntity {
  id: string;
  organizationId: string;
  costCenterId: string | null;
  name: string;
  category: string | null;
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FinanceOverviewEntity {
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  pendingExpenses: number;
  budgetedExpenses: number;
  budgetVariance: number;
}
