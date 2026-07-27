import "server-only";

/**
 * Shared delivery and validation for the lead-capture forms (Book a Demo,
 * Join the Beta). The contact form's action predates this and keeps its own
 * copy; these two flows go through here so the Resend wiring, the failure
 * messages and the "configured but undeliverable" behaviour stay identical.
 */

export interface LeadFormState {
  status: "idle" | "success" | "error";
  message?: string;
  /** Field name to focus and describe when validation fails. */
  fieldError?: string;
  /**
   * What the user submitted, echoed back so the form can re-populate itself.
   * React resets uncontrolled inputs once an action completes, so without this
   * a rejected submission empties every field — which on a seven-field B2B
   * form means most people simply leave.
   */
  values?: Record<string, string>;
}

/** Collects the submitted values so a rejected submission can be re-rendered filled in. */
export function collectValues(formData: FormData, fields: readonly string[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Domains we ask people not to use, since these are sales-qualified forms. */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

export function isValidWorkEmail(email: string): boolean {
  if (!EMAIL_PATTERN.test(email) || email.length > 320) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return domain !== undefined && !FREE_EMAIL_DOMAINS.has(domain);
}

export function readField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/**
 * Validates one required text field. Returns an error state, or null when the
 * value is acceptable.
 */
export function requireText(
  value: string,
  field: string,
  label: string,
  { min = 1, max = 500 }: { min?: number; max?: number } = {},
): LeadFormState | null {
  if (value.length < min) {
    return {
      status: "error",
      fieldError: field,
      message:
        min > 1
          ? `Please give us a little more detail for "${label}" (at least ${min} characters).`
          : `Please enter ${label.toLowerCase()}.`,
    };
  }
  if (value.length > max) {
    return {
      status: "error",
      fieldError: field,
      message: `"${label}" is too long — please keep it under ${max} characters.`,
    };
  }
  return null;
}

/** Validates a select against its allowed values, so a tampered POST cannot inject arbitrary text. */
export function requireChoice(
  value: string,
  allowed: readonly string[],
  field: string,
  label: string,
): LeadFormState | null {
  if (!value || !allowed.includes(value)) {
    return { status: "error", fieldError: field, message: `Please select ${label.toLowerCase()}.` };
  }
  return null;
}

export interface LeadEmail {
  subject: string;
  /** Ordered label/value pairs rendered into the notification body. */
  fields: { label: string; value: string }[];
  replyTo: string;
  successMessage: string;
}

export async function deliverLead({
  subject,
  fields,
  replyTo,
  successMessage,
}: LeadEmail): Promise<LeadFormState> {
  const apiKey = process.env.RESEND_API_KEY;
  const toAddress = process.env.CONTACT_FORM_RECIPIENT ?? "sales@usevoltx.com";

  // Without a key the submission is validated but cannot be delivered. Say so
  // rather than showing a success screen for a lead nobody will ever receive.
  if (!apiKey) {
    console.error("RESEND_API_KEY is not configured — lead was validated but not sent.", {
      subject,
    });
    return {
      status: "error",
      message:
        "Something went wrong on our end. Please email sales@usevoltx.com and we'll pick it up right away.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Voltx Website <contact@usevoltx.com>",
        to: [toAddress],
        reply_to: replyTo,
        subject,
        text: fields.map((field) => `${field.label}: ${field.value}`).join("\n"),
      }),
    });

    if (!response.ok) {
      console.error("Resend API error", response.status, await response.text());
      return {
        status: "error",
        message: "We couldn't submit that right now. Please try again in a moment.",
      };
    }

    return { status: "success", message: successMessage };
  } catch (error) {
    console.error("Lead submission failed", error);
    return {
      status: "error",
      message: "We couldn't submit that right now. Please try again in a moment.",
    };
  }
}
