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
import { submitBetaRequest, type LeadFormState } from "./actions";

const initialState: LeadFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Requesting access…
        </>
      ) : (
        "Request beta access"
      )}
    </Button>
  );
}

export function BetaForm() {
  const [state, formAction] = useActionState(submitBetaRequest, initialState);

  // React resets uncontrolled inputs once the action resolves; the action
  // echoes the submitted values back so a rejected attempt keeps them.
  const prior = (name: string) => state.values?.[name] ?? "";

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-4 rounded-card border border-success/30 bg-success/5 p-10 text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <h2 className="text-xl font-semibold">You&apos;re on the list</h2>
        <p className="max-w-md text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="company">
            Company <span className="text-destructive">*</span>
          </Label>
          <Input
            id="company"
            name="company"
            required
            defaultValue={prior("company")}
            autoComplete="organization"
            placeholder="Acme Inc."
            aria-describedby={state.fieldError === "company" ? "form-error" : undefined}
          />
        </div>
        <div>
          <Label htmlFor="email">
            Work email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={prior("email")}
            autoComplete="email"
            placeholder="jane@acme.com"
            aria-describedby={state.fieldError === "email" ? "form-error" : undefined}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
      </div>

      <div>
        <Label htmlFor="useCase">
          Expected use case <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="useCase"
          name="useCase"
          required
          defaultValue={prior("useCase")}
          minLength={20}
          placeholder="What would you use Voltx for first? Teams with a specific starting workflow get onboarded soonest."
          aria-describedby={state.fieldError === "useCase" ? "form-error" : undefined}
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
        Beta access is free. See our{" "}
        <a href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
