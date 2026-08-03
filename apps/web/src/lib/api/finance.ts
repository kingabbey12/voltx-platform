import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export type FinancialTransactionType = "INCOME" | "EXPENSE";
export type FinancialTransactionStatus = "PENDING" | "POSTED" | "VOID";

export interface FinancialTransaction {
  id: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  category: string;
  amount: number;
  currency: string;
  occurredAt: string;
  costCenterId: string | null;
  counterpartyName: string | null;
  description: string | null;
  externalReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialBudget {
  id: string;
  name: string;
  category: string | null;
  amount: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  costCenterId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceOverview {
  periodStart: string;
  periodEnd: string;
  currency: string;
  income: number;
  expenses: number;
  netCashFlow: number;
  pendingExpenses: number;
  budgetedExpenses: number;
  budgetVariance: number;
}

export interface CreateFinancialTransactionInput {
  type: FinancialTransactionType;
  status?: FinancialTransactionStatus;
  category: string;
  amount: number;
  currency: string;
  occurredAt: string;
  counterpartyName?: string;
  description?: string;
}

export interface CreateFinancialBudgetInput {
  name: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  category?: string;
  currency: string;
}

export const financeApi = {
  getOverview: () => apiClient.get<FinanceOverview>("/finance/overview"),
  listTransactions: () =>
    apiClient.get<PaginatedResult<FinancialTransaction>>(
      "/finance/transactions",
      {
        query: { page: 1, limit: 50 },
      },
    ),
  createTransaction: (input: CreateFinancialTransactionInput) =>
    apiClient.post<FinancialTransaction>("/finance/transactions", input),
  deleteTransaction: (id: string) =>
    apiClient.delete<void>(`/finance/transactions/${id}`),
  listBudgets: () => apiClient.get<FinancialBudget[]>("/finance/budgets"),
  createBudget: (input: CreateFinancialBudgetInput) =>
    apiClient.post<FinancialBudget>("/finance/budgets", input),
  deleteBudget: (id: string) =>
    apiClient.delete<void>(`/finance/budgets/${id}`),
};
