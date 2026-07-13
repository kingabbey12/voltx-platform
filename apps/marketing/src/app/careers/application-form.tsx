"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobListing } from "@/lib/careers";
import { submitJobApplication, type ApplicationFormState } from "./actions";

const initialState: ApplicationFormState = { status: "idle" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Submitting...
        </>
      ) : (
        "Submit application"
      )}
    </Button>
  );
}

export function ApplicationForm({ jobs }: { jobs: JobListing[] }) {
  const [state, formAction] = useActionState(submitJobApplication, initialState);
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get("role");
  const [role, setRole] = useState(
    roleFromUrl && jobs.some((job) => job.id === roleFromUrl) ? roleFromUrl : "",
  );

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div>
        <Label htmlFor="role">Role</Label>
        <select
          id="role"
          name="role"
          required
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="flex h-11 w-full rounded-lg border border-input bg-background/60 px-4 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <option value="" disabled>
            Select a role
          </option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} — {job.department}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required autoComplete="name" placeholder="Jane Cooper" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="jane@example.com"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="portfolioUrl">Portfolio, resume, or LinkedIn URL</Label>
        <Input
          id="portfolioUrl"
          name="portfolioUrl"
          type="url"
          placeholder="https://"
          autoComplete="url"
        />
      </div>

      <div>
        <Label htmlFor="message">Why this role?</Label>
        <Textarea
          id="message"
          name="message"
          required
          minLength={10}
          placeholder="Tell us about relevant experience and why you're interested..."
        />
      </div>

      {state.status !== "idle" && state.message && (
        <div
          role="status"
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
