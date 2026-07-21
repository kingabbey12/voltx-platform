import { z } from "zod";

export const createPromiseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  contactId: z.string().trim().min(1, "Choose who the company is promising"),
  dueAt: z.string().trim().optional().or(z.literal("")),
});
export type CreatePromiseFormValues = z.infer<typeof createPromiseSchema>;
