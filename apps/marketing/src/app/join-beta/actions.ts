"use server";

import { companySizes, industries } from "@/config/forms";
import {
  collectValues,
  deliverLead,
  isValidWorkEmail,
  readField,
  requireChoice,
  requireText,
  type LeadFormState,
} from "@/lib/lead-submission";

export type { LeadFormState };

const FIELDS = ["company", "email", "industry", "companySize", "useCase"] as const;

export async function submitBetaRequest(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const company = readField(formData, "company");
  const email = readField(formData, "email");
  const industry = readField(formData, "industry");
  const companySize = readField(formData, "companySize");
  const useCase = readField(formData, "useCase");

  const values = collectValues(formData, FIELDS);

  const failure =
    requireText(company, "company", "Company", { max: 200 }) ??
    requireChoice(industry, industries, "industry", "Industry") ??
    requireChoice(companySize, companySizes, "companySize", "Company size") ??
    requireText(useCase, "useCase", "Expected use case", { min: 20, max: 4000 });

  if (failure) return { ...failure, values };

  if (!isValidWorkEmail(email)) {
    return {
      status: "error",
      fieldError: "email",
      message: "Please use your work email address — beta access is granted per organization.",
      values,
    };
  }

  const result = await deliverLead({
    subject: `Beta request — ${company} (${companySize})`,
    replyTo: email,
    fields: [
      { label: "Company", value: company },
      { label: "Email", value: email },
      { label: "Industry", value: industry },
      { label: "Company size", value: companySize },
      { label: "Expected use case", value: useCase },
    ],
    successMessage:
      "You're on the list. We're onboarding a small group at a time — we'll email you when your spot opens.",
  });

  return result.status === "success" ? result : { ...result, values };
}
