"use server";

export interface ContactFormState {
  status: "idle" | "success" | "error";
  message?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || name.length > 200) {
    return { status: "error", message: "Please enter your name." };
  }
  if (!email || !isValidEmail(email) || email.length > 320) {
    return { status: "error", message: "Please enter a valid email address." };
  }
  if (!message || message.length < 10) {
    return { status: "error", message: "Please include a few details about what you need." };
  }
  if (message.length > 5000) {
    return { status: "error", message: "Message is too long. Please keep it under 5000 characters." };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const toAddress = process.env.CONTACT_FORM_RECIPIENT ?? "sales@usevoltx.com";

  // Requires RESEND_API_KEY to be configured. Without it, submissions are
  // validated but not delivered — set the env var in production to enable
  // real delivery via Resend's transactional email API.
  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is not configured — contact form submission was validated but not sent.",
    );
    return {
      status: "error",
      message: "Something went wrong on our end. Please email us directly at sales@usevoltx.com.",
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
        from: "Voltx Website <contact@usevoltx.com>",
        to: [toAddress],
        reply_to: email,
        subject: `New contact form submission from ${name}`,
        text: [
          `Name: ${name}`,
          `Email: ${email}`,
          company ? `Company: ${company}` : null,
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
        message: "We couldn't send your message right now. Please try again shortly.",
      };
    }

    return { status: "success", message: "Thanks — we'll be in touch within one business day." };
  } catch (error) {
    console.error("Contact form submission failed", error);
    return {
      status: "error",
      message: "We couldn't send your message right now. Please try again shortly.",
    };
  }
}
