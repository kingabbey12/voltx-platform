import { z } from "zod";

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required").max(255),
  domain: z.string().trim().max(255).optional().or(z.literal("")),
  industry: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.enum(["PROSPECT", "ACTIVE", "INACTIVE"]),
});
export type CompanyFormValues = z.infer<typeof companySchema>;

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  jobTitle: z.string().trim().max(150).optional().or(z.literal("")),
});
export type ContactFormValues = z.infer<typeof contactSchema>;

export const leadSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  source: z.string().trim().max(100).optional().or(z.literal("")),
  status: z.enum(["NEW", "QUALIFIED", "NURTURING", "DISQUALIFIED", "CONVERTED"]),
});
export type LeadFormValues = z.infer<typeof leadSchema>;

export const opportunitySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  stage: z.enum(["DISCOVERY", "QUALIFICATION", "PROPOSAL", "NEGOTIATION", "CLOSED_WON", "CLOSED_LOST"]),
  amount: z.coerce.number().min(0).optional(),
});
export type OpportunityFormValues = z.infer<typeof opportunitySchema>;

export const activitySchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "TASK", "NOTE"]),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
});
export type ActivityFormValues = z.infer<typeof activitySchema>;
