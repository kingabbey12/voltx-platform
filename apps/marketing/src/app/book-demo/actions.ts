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

const FIELDS = [
  "companyName",
  "contactName",
  "workEmail",
  "phone",
  "companySize",
  "industry",
  "challenge",
] as const;

export type { LeadFormState };

export async function submitDemoRequest(
  _prevState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const companyName = readField(formData, "companyName");
  const contactName = readField(formData, "contactName");
  const workEmail = readField(formData, "workEmail");
  const phone = readField(formData, "phone");
  const companySize = readField(formData, "companySize");
  const industry = readField(formData, "industry");
  const challenge = readField(formData, "challenge");

  // Echoed back on every failure path so nothing the user typed is lost.
  const values = collectValues(formData, FIELDS);

  const failure =
    requireText(companyName, "companyName", "Company name", { max: 200 }) ??
    requireText(contactName, "contactName", "Contact name", { max: 200 }) ??
    requireChoice(companySize, companySizes, "companySize", "Company size") ??
    requireChoice(industry, industries, "industry", "Industry") ??
    // 20 characters is enough to rule out "hi" without demanding an essay.
    requireText(challenge, "challenge", "Biggest business challenge", { min: 20, max: 4000 });

  if (failure) return { ...failure, values };

  if (!isValidWorkEmail(workEmail)) {
    return {
      status: "error",
      fieldError: "workEmail",
      message: "Please use your work email address so we can route this to the right team.",
      values,
    };
  }

  // Phone is optional, but if given it should look like a phone number.
  if (phone && !/^[\d\s()+.-]{7,32}$/.test(phone)) {
    return {
      status: "error",
      fieldError: "phone",
      message: "That phone number doesn't look right. Leave it blank if you'd rather not share it.",
      values,
    };
  }

  const result = await deliverLead({
    subject: `Demo request — ${companyName} (${companySize})`,
    replyTo: workEmail,
    fields: [
      { label: "Company", value: companyName },
      { label: "Contact", value: contactName },
      { label: "Work email", value: workEmail },
      { label: "Phone", value: phone || "Not provided" },
      { label: "Company size", value: companySize },
      { label: "Industry", value: industry },
      { label: "Biggest business challenge", value: challenge },
    ],
    successMessage:
      "Thanks — we'll be in touch within one business day to schedule your demo.",
  });

  // A delivery failure must not wipe a seven-field form either.
  return result.status === "success" ? result : { ...result, values };
}
