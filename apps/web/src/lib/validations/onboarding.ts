import { z } from "zod";
import type { CompanySize } from "@/lib/api/organizations";

export const businessInfoSchema = z.object({
  name: z.string().trim().min(2, "Business name must be at least 2 characters").max(255),
  email: z.string().trim().min(1, "Business email is required").email("Enter a valid email address"),
  website: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^https?:\/\/.+/i.test(value), {
      message: "Enter a full URL, e.g. https://example.com",
    }),
  industry: z.string().trim().min(1, "Select an industry"),
  country: z.string().trim().length(2, "Select a country"),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  companySize: z.string().trim().min(1, "Select a company size") as z.ZodType<CompanySize | string>,
  primaryGoals: z.array(z.string()).min(1, "Select at least one goal"),
  currency: z.string().trim().length(3, "Select a currency").optional().or(z.literal("")),
  language: z.string().trim().optional().or(z.literal("")),
  timezone: z.string().trim().optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^\+[1-9]\d{6,14}$/.test(value), {
      message: "Enter a valid phone number",
    }),
});
export type BusinessInfoFormValues = z.infer<typeof businessInfoSchema>;

export const COMPANY_SIZE_OPTIONS: { value: CompanySize; label: string }[] = [
  { value: "JUST_ME", label: "Just Me" },
  { value: "EMPLOYEES_2_10", label: "2–10 employees" },
  { value: "EMPLOYEES_11_50", label: "11–50 employees" },
  { value: "EMPLOYEES_51_200", label: "51–200 employees" },
  { value: "EMPLOYEES_201_500", label: "201–500 employees" },
  { value: "EMPLOYEES_501_1000", label: "501–1000 employees" },
  { value: "EMPLOYEES_1000_PLUS", label: "1000+ employees" },
];

export const PRIMARY_GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: "SALES", label: "Sales" },
  { value: "MARKETING", label: "Marketing" },
  { value: "CUSTOMER_SUPPORT", label: "Customer Support" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "PROJECT_MANAGEMENT", label: "Project Management" },
  { value: "FINANCE", label: "Finance" },
  { value: "HUMAN_RESOURCES", label: "Human Resources" },
  { value: "AI_AUTOMATION", label: "AI Automation" },
  { value: "TEAM_COLLABORATION", label: "Team Collaboration" },
  { value: "BUSINESS_INTELLIGENCE", label: "Business Intelligence" },
  { value: "CRM", label: "CRM" },
  { value: "WORKFLOW_AUTOMATION", label: "Workflow Automation" },
];
