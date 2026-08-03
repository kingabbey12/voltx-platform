import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  financeApi,
  type CreateFinancialBudgetInput,
  type CreateFinancialTransactionInput,
} from "@/lib/api/finance";

export function useFinanceOverview() {
  return useQuery({
    queryKey: ["finance", "overview"],
    queryFn: financeApi.getOverview,
    staleTime: 30_000,
  });
}

export function useFinancialTransactions() {
  return useQuery({
    queryKey: ["finance", "transactions"],
    queryFn: financeApi.listTransactions,
  });
}

export function useFinancialBudgets() {
  return useQuery({
    queryKey: ["finance", "budgets"],
    queryFn: financeApi.listBudgets,
  });
}

function useRefreshFinance() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["finance"] });
}

export function useCreateFinancialTransaction() {
  const refresh = useRefreshFinance();
  return useMutation({
    mutationFn: (input: CreateFinancialTransactionInput) =>
      financeApi.createTransaction(input),
    onSuccess: refresh,
  });
}

export function useDeleteFinancialTransaction() {
  const refresh = useRefreshFinance();
  return useMutation({
    mutationFn: financeApi.deleteTransaction,
    onSuccess: refresh,
  });
}

export function useCreateFinancialBudget() {
  const refresh = useRefreshFinance();
  return useMutation({
    mutationFn: (input: CreateFinancialBudgetInput) =>
      financeApi.createBudget(input),
    onSuccess: refresh,
  });
}

export function useDeleteFinancialBudget() {
  const refresh = useRefreshFinance();
  return useMutation({
    mutationFn: financeApi.deleteBudget,
    onSuccess: refresh,
  });
}
