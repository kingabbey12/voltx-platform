"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArrowDownRight,
  ArrowUpRight,
  Landmark,
  MoreHorizontal,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { QueryErrorState } from "@/components/query-error-state";
import {
  useCreateFinancialBudget,
  useCreateFinancialTransaction,
  useDeleteFinancialBudget,
  useDeleteFinancialTransaction,
  useFinanceOverview,
  useFinancialBudgets,
  useFinancialTransactions,
} from "@/hooks/use-finance";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { FinancialTransactionStatus } from "@/lib/api/finance";
import {
  financialBudgetSchema,
  financialTransactionSchema,
  type FinancialBudgetFormValues,
  type FinancialTransactionFormValues,
} from "@/lib/validations/finance";

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;
const monthEnd = new Date(
  new Date(today).getFullYear(),
  new Date(today).getMonth() + 1,
  0,
)
  .toISOString()
  .slice(0, 10);

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

const STATUS_VARIANT: Record<
  FinancialTransactionStatus,
  "success" | "warning" | "secondary"
> = {
  POSTED: "success",
  PENDING: "warning",
  VOID: "secondary",
};

export default function FinancePage() {
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const overview = useFinanceOverview();
  const transactions = useFinancialTransactions();
  const budgets = useFinancialBudgets();
  const createTransaction = useCreateFinancialTransaction();
  const deleteTransaction = useDeleteFinancialTransaction();
  const createBudget = useCreateFinancialBudget();
  const deleteBudget = useDeleteFinancialBudget();

  const transactionForm = useForm<FinancialTransactionFormValues>({
    resolver: zodResolver(financialTransactionSchema),
    defaultValues: {
      type: "EXPENSE",
      status: "POSTED",
      category: "",
      amount: undefined,
      currency: "USD",
      occurredAt: today,
      counterpartyName: "",
      description: "",
    },
  });
  const budgetForm = useForm<FinancialBudgetFormValues>({
    resolver: zodResolver(financialBudgetSchema),
    defaultValues: {
      name: "",
      category: "",
      amount: undefined,
      currency: "USD",
      periodStart: monthStart,
      periodEnd: monthEnd,
    },
  });

  async function submitTransaction(values: FinancialTransactionFormValues) {
    try {
      await createTransaction.mutateAsync({
        ...values,
        occurredAt: new Date(
          `${values.occurredAt}T12:00:00.000Z`,
        ).toISOString(),
        counterpartyName: values.counterpartyName || undefined,
        description: values.description || undefined,
      });
      toast.success("Transaction recorded");
      setTransactionOpen(false);
      transactionForm.reset({
        type: "EXPENSE",
        status: "POSTED",
        category: "",
        amount: undefined,
        currency: "USD",
        occurredAt: today,
        counterpartyName: "",
        description: "",
      });
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function submitBudget(values: FinancialBudgetFormValues) {
    try {
      await createBudget.mutateAsync({
        ...values,
        category: values.category || undefined,
      });
      toast.success("Budget created");
      setBudgetOpen(false);
      budgetForm.reset({
        name: "",
        category: "",
        amount: undefined,
        currency: "USD",
        periodStart: monthStart,
        periodEnd: monthEnd,
      });
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function removeTransaction(id: string) {
    try {
      await deleteTransaction.mutateAsync(id);
      toast.success("Transaction deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function removeBudget(id: string) {
    try {
      await deleteBudget.mutateAsync(id);
      toast.success("Budget deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const summary = overview.data;
  const loading =
    overview.isLoading || transactions.isLoading || budgets.isLoading;
  const failed = overview.isError || transactions.isError || budgets.isError;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Finance"
        description="Cash flow, operating budgets, and the transactions behind them."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setBudgetOpen(true)}>
              <Landmark className="h-4 w-4" />
              New budget
            </Button>
            <Button onClick={() => setTransactionOpen(true)}>
              <Plus className="h-4 w-4" />
              Record transaction
            </Button>
          </div>
        }
      />

      {failed && (
        <QueryErrorState
          title="Finance data could not be loaded"
          onRetry={() => {
            void overview.refetch();
            void transactions.refetch();
            void budgets.refetch();
          }}
        />
      )}

      {!failed && (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Finance overview"
          >
            <Metric
              title="Income"
              value={summary ? money(summary.income, summary.currency) : "--"}
              icon={ArrowUpRight}
              tone="text-success"
              loading={loading}
            />
            <Metric
              title="Expenses"
              value={summary ? money(summary.expenses, summary.currency) : "--"}
              icon={ArrowDownRight}
              tone="text-destructive"
              loading={loading}
            />
            <Metric
              title="Net cash flow"
              value={
                summary ? money(summary.netCashFlow, summary.currency) : "--"
              }
              icon={WalletCards}
              tone={
                summary && summary.netCashFlow < 0
                  ? "text-destructive"
                  : "text-primary"
              }
              loading={loading}
            />
            <Metric
              title="Budget remaining"
              value={
                summary ? money(summary.budgetVariance, summary.currency) : "--"
              }
              icon={Landmark}
              tone={
                summary && summary.budgetVariance < 0
                  ? "text-destructive"
                  : "text-info"
              }
              loading={loading}
            />
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.85fr)]">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold">Transactions</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Posted and pending records for this organization.
                  </p>
                </div>
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
              </div>
              {loading && (
                <div className="space-y-3 p-5">
                  {[1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-14 animate-pulse rounded-md bg-muted"
                    />
                  ))}
                </div>
              )}
              {!loading && transactions.data?.items.length === 0 && (
                <EmptyState
                  icon={ReceiptText}
                  title="Start your financial record"
                  description="Record income and expenses to see cash flow and budget performance."
                  action={
                    <Button size="sm" onClick={() => setTransactionOpen(true)}>
                      <Plus className="h-4 w-4" />
                      Record transaction
                    </Button>
                  }
                />
              )}
              {!loading &&
                transactions.data &&
                transactions.data.items.length > 0 && (
                  <div className="divide-y divide-border">
                    {transactions.data.items.map((transaction) => {
                      const isIncome = transaction.type === "INCOME";
                      return (
                        <div
                          key={transaction.id}
                          className="flex items-center gap-3 px-5 py-3"
                        >
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${isIncome ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="h-4 w-4" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {transaction.counterpartyName ||
                                transaction.category}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {transaction.category} ·{" "}
                              {shortDate(transaction.occurredAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-sm font-semibold ${isIncome ? "text-success" : "text-foreground"}`}
                            >
                              {isIncome ? "+" : "-"}
                              {money(transaction.amount, transaction.currency)}
                            </p>
                            <Badge
                              className="mt-1"
                              variant={STATUS_VARIANT[transaction.status]}
                            >
                              {transaction.status}
                            </Badge>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={`Options for ${transaction.category}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  removeTransaction(transaction.id)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold">Budgets</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Active spending plans and time windows.
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setBudgetOpen(true)}
                  aria-label="Create budget"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {loading && (
                <div className="space-y-3 p-5">
                  {[1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-md bg-muted"
                    />
                  ))}
                </div>
              )}
              {!loading && budgets.data?.length === 0 && (
                <EmptyState
                  icon={Landmark}
                  title="No budgets yet"
                  description="Set a budget to track operating spend against a target."
                  action={
                    <Button size="sm" onClick={() => setBudgetOpen(true)}>
                      <Plus className="h-4 w-4" />
                      New budget
                    </Button>
                  }
                />
              )}
              {!loading && budgets.data && budgets.data.length > 0 && (
                <div className="divide-y divide-border">
                  {budgets.data.map((budget) => (
                    <div key={budget.id} className="flex gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {budget.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {budget.category || "All categories"} ·{" "}
                          {shortDate(budget.periodStart)} to{" "}
                          {shortDate(budget.periodEnd)}
                        </p>
                        <p className="mt-3 text-base font-semibold">
                          {money(budget.amount, budget.currency)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Options for ${budget.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => removeBudget(budget.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}

      <TransactionDialog
        open={transactionOpen}
        onOpenChange={setTransactionOpen}
        form={transactionForm}
        onSubmit={submitTransaction}
        pending={createTransaction.isPending}
      />
      <BudgetDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        form={budgetForm}
        onSubmit={submitBudget}
        pending={createBudget.isPending}
      />
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  title: string;
  value: string;
  icon: typeof WalletCards;
  tone: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight">
        {loading ? (
          <span className="inline-block h-6 w-24 animate-pulse rounded bg-muted" />
        ) : (
          value
        )}
      </p>
    </div>
  );
}

function TransactionDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ReturnType<typeof useForm<FinancialTransactionFormValues>>;
  onSubmit: (values: FinancialTransactionFormValues) => Promise<void>;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record transaction</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                        <SelectItem value="INCOME">Income</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="POSTED">Posted</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="Software" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="counterpartyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Counterparty</FormLabel>
                    <FormControl>
                      <Input placeholder="Vendor or customer" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-[1fr_5rem] gap-3">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" min="0.01" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={3}
                        {...field}
                        onChange={(event) =>
                          field.onChange(event.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="occurredAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional context"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={pending}>
                Record transaction
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  form,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ReturnType<typeof useForm<FinancialBudgetFormValues>>;
  onSubmit: (values: FinancialBudgetFormValues) => Promise<void>;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create budget</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Q3 operating expenses" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input placeholder="All categories" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Budget amount</FormLabel>
                    <FormControl>
                      <Input type="number" min="0.01" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input
                      maxLength={3}
                      className="w-20"
                      {...field}
                      onChange={(event) =>
                        field.onChange(event.target.value.toUpperCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={pending}>
                Create budget
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
