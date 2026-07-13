"use server";

import { getJobListing } from "@/lib/careers";

export interface ApplicationFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function submitJobApplication(
  _prevState: ApplicationFormState,
  formData: FormData,
): Promise<ApplicationFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const roleId = String(formData.get("role") ?? "").trim();
  const portfolioUrl = String(formData.get("portfolioUrl") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || name.length > 200) {
    return { status: "error", message: "Please enter your name." };
  }
  if (!email || !isValidEmail(email) || email.length > 320) {
    return { status: "error", message: "Please enter a valid email address." };
  }
  const role = getJobListing(roleId);
  if (!role) {
    return { status: "error", message: "Please select a role." };
  }
  if (portfolioUrl && !isValidUrl(portfolioUrl)) {
    return { status: "error", message: "Please enter a valid URL for your portfolio or resume." };
  }
  if (!message || message.length < 10) {
    return { status: "error", message: "Tell us a little about why you're a fit for this role." };
  }
  if (message.length > 5000) {
    return { status: "error", message: "Message is too long. Please keep it under 5000 characters." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toAddress = process.env.CAREERS_FORM_RECIPIENT ?? "careers@usevoltx.com";

  // Same delivery mechanism as the contact form (see app/contact/actions.ts)
  // — requires RESEND_API_KEY to be configured for real delivery.
  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is not configured — job application was validated but not sent.",
    );
    return {
      status: "error",
      message: "Something went wrong on our end. Please email us directly at careers@usevoltx.com.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Voltx Careers <careers@usevoltx.com>",
        to: [toAddress],
        reply_to: email,
        subject: `New application: ${role.title} — ${name}`,
        text: [
          `Role: ${role.title} (${role.department})`,
          `Name: ${name}`,
          `Email: ${email}`,
          portfolioUrl ? `Portfolio / resume: ${portfolioUrl}` : null,
          "",
          message,
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    });

    if (!response.ok) {
      console.error("Resend API error", response.status, await response.text());
      return {
        status: "error",
        message: "We couldn't submit your application right now. Please try again shortly.",
      };
    }

    return {
      status: "success",
      message: `Thanks for applying to ${role.title} — we'll be in touch if it's a fit.`,
    };
  } catch (error) {
    console.error("Job application submission failed", error);
    return {
      status: "error",
      message: "We couldn't submit your application right now. Please try again shortly.",
    };
  }
}
