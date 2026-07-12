"use client";

import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";

interface StripeSetupFormProps {
  onConfirmed: (stripePaymentMethodId: string) => Promise<void>;
  onCancel: () => void;
}

/** Renders inside an <Elements> provider — useStripe/useElements only resolve there. */
export function StripeSetupForm({ onConfirmed, onCancel }: StripeSetupFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Please check your card details.");
      setSubmitting(false);
      return;
    }

    const { error: confirmError, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (confirmError || !setupIntent?.payment_method) {
      setError(confirmError?.message ?? "Could not save this payment method.");
      setSubmitting(false);
      return;
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

    await onConfirmed(paymentMethodId);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" isLoading={submitting} disabled={!stripe || !elements}>
          Save payment method
        </Button>
      </DialogFooter>
    </form>
  );
}
