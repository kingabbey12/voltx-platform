import { z } from "zod";

const currency = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Use a three-letter currency code");

export const financialTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  status: z.enum(["PENDING", "POSTED"]).default("POSTED"),
  category: z.string().trim().min(1, "Category is required").max(100),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  currency,
  occurredAt: z.string().min(1, "Date is required"),
  counterpartyName: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});
export type FinancialTransactionFormValues = z.infer<
  typeof financialTransactionSchema
>;

export const financialBudgetSchema = z
  .object({
    name: z.string().trim().min(1, "Budget name is required").max(160),
    category: z.string().trim().max(100).optional().or(z.literal("")),
    amount: z.coerce.number().positive("Budget must be greater than zero"),
    currency,
    periodStart: z.string().min(1, "Start date is required"),
    periodEnd: z.string().min(1, "End date is required"),
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "End date must be on or after the start date",
    path: ["periodEnd"],
  });
export type FinancialBudgetFormValues = z.infer<typeof financialBudgetSchema>;
