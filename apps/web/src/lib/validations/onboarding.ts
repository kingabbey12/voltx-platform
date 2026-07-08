import { z } from "zod";

export const businessInfoSchema = z.object({
  name: z.string().trim().min(2, "Company name must be at least 2 characters").max(255),
  industry: z.string().optional(),
  country: z.string().trim().max(100).optional(),
});
export type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>;

export const INDUSTRY_OPTIONS = [
  "Technology",
  "Energy & Utilities",
  "Financial Services",
  "Healthcare",
  "Retail & E-commerce",
  "Manufacturing",
  "Professional Services",
  "Other",
] as const;
