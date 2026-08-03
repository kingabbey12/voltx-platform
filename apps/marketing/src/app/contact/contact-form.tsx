"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactForm, type ContactFormState } from "./actions";

const initialState: ContactFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Sending...
        </>
      ) : (
        "Send message"
      )}
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactForm, initialState);
  const prior = (name: string) => state.values?.[name] ?? "";

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={prior("name")}
            autoComplete="name"
            placeholder="Jane Cooper"
            aria-invalid={state.fieldError === "name" || undefined}
            aria-describedby={state.fieldError === "name" ? "form-error" : undefined}
          />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            defaultValue={prior("email")}
            autoComplete="email"
            placeholder="jane@company.com"
            aria-invalid={state.fieldError === "email" || undefined}
            aria-describedby={state.fieldError === "email" ? "form-error" : undefined}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          name="company"
          defaultValue={prior("company")}
          autoComplete="organization"
          placeholder="Acme Inc."
        />
      </div>

      <div>
        <Label htmlFor="message">How can we help?</Label>
        <Textarea
          id="message"
          name="message"
          required
          defaultValue={prior("message")}
          minLength={10}
          placeholder="Tell us a bit about your team and what you're looking for..."
          aria-invalid={state.fieldError === "message" || undefined}
          aria-describedby={state.fieldError === "message" ? "form-error" : undefined}
        />
      </div>

      {state.status !== "idle" && state.message && (
        <div
          id={state.fieldError ? "form-error" : undefined}
          role={state.status === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            state.status === "success"
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {state.status === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {state.message}
        </div>
      )}

      <SubmitButton />

      <p className="text-center text-xs text-muted-foreground">
        By submitting, you agree to our{" "}
        <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy Policy
        </a>
        .
      </p>
    </form>
  );
}
