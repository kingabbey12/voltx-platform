"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { companySizes, industries } from "@/config/forms";
import { submitDemoRequest, type LeadFormState } from "./actions";

const initialState: LeadFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Submitting…
        </>
      ) : (
        "Request my demo"
      )}
    </Button>
  );
}

export function DemoForm() {
  const [state, formAction] = useActionState(submitDemoRequest, initialState);

  // React resets uncontrolled inputs once the action resolves, so a rejected
  // submission would otherwise empty all seven fields. The action echoes the
  // submitted values back and we seed them here.
  const prior = (name: string) => state.values?.[name] ?? "";

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-card border border-success/30 bg-success/5 p-10 text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h2 className="text-xl font-semibold">Request received</h2>
        <p className="max-w-md text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="companyName">
            Company name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="companyName"
            name="companyName"
            required
            defaultValue={prior("companyName")}
            autoComplete="organization"
            placeholder="Acme Inc."
            aria-describedby={state.fieldError === "companyName" ? "form-error" : undefined}
          />
        </div>
        <div>
          <Label htmlFor="contactName">
            Contact name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="contactName"
            name="contactName"
            required
            defaultValue={prior("contactName")}
            autoComplete="name"
            placeholder="Jane Cooper"
            aria-describedby={state.fieldError === "contactName" ? "form-error" : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="workEmail">
            Work email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="workEmail"
            name="workEmail"
            type="email"
            required
            defaultValue={prior("workEmail")}
            autoComplete="email"
            placeholder="jane@acme.com"
            aria-describedby={state.fieldError === "workEmail" ? "form-error" : undefined}
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={prior("phone")}
            autoComplete="tel"
            placeholder="+1 (555) 000-0000"
            aria-describedby={state.fieldError === "phone" ? "form-error" : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="companySize">
            Company size <span className="text-destructive">*</span>
          </Label>
          <Select
            id="companySize"
            name="companySize"
            required
            // defaultValue is mount-only on a select; re-key so an echoed
            // value is actually applied after a rejected submission.
            key={prior("companySize")}
            defaultValue={prior("companySize")}
          >
            <option value="" disabled>
              Select company size
            </option>
            {companySizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="industry">
            Industry <span className="text-destructive">*</span>
          </Label>
          <Select
            id="industry"
            name="industry"
            required
            // defaultValue is mount-only on a select; re-key so an echoed
            // value is actually applied after a rejected submission.
            key={prior("industry")}
            defaultValue={prior("industry")}
          >
            <option value="" disabled>
              Select industry
            </option>
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="challenge">
          Biggest business challenge <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="challenge"
          name="challenge"
          required
          defaultValue={prior("challenge")}
          minLength={20}
          placeholder="What are you trying to solve? The more specific you are, the more we can tailor the demo."
          aria-describedby={state.fieldError === "challenge" ? "form-error" : undefined}
        />
      </div>

      {state.status === "error" && state.message && (
        <div
          id="form-error"
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{state.message}</span>
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-xs text-muted-foreground">
        We&apos;ll only use this to prepare and schedule your demo. See our{" "}
        <a href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
