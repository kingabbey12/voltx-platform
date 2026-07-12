"use client";

import { useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { CreditCard, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import {
  useAttachPaymentMethod,
  useCreateSetupIntent,
  usePaymentMethods,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
} from "@/hooks/use-billing";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { StripeSetupForm } from "./stripe-setup-form";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise: Promise<Stripe | null> | null = publishableKey
  ? loadStripe(publishableKey)
  : null;

export default function BillingPaymentMethodsPage() {
  const { data: paymentMethods, isLoading } = usePaymentMethods();
  const createSetupIntent = useCreateSetupIntent();
  const attachPaymentMethod = useAttachPaymentMethod();
  const setDefaultPaymentMethod = useSetDefaultPaymentMethod();
  const removePaymentMethod = useRemovePaymentMethod();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  async function openAddDialog() {
    setDialogOpen(true);
    setClientSecret(null);
    try {
      const { clientSecret: secret } = await createSetupIntent.mutateAsync();
      setClientSecret(secret);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
      setDialogOpen(false);
    }
  }

  async function handleConfirmed(stripePaymentMethodId: string) {
    try {
      await attachPaymentMethod.mutateAsync({
        stripePaymentMethodId,
        makeDefault: (paymentMethods?.length ?? 0) === 0,
      });
      toast.success("Payment method saved");
      setDialogOpen(false);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultPaymentMethod.mutateAsync(id);
      toast.success("Default payment method updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleRemove(id: string) {
    try {
      await removePaymentMethod.mutateAsync(id);
      toast.success("Payment method removed");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payment Methods"
        description="Manage the cards on file for your organization."
        action={
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add payment method
          </Button>
        }
      />

      <div className="rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && paymentMethods?.length === 0 && (
          <EmptyState
            icon={CreditCard}
            title="No payment methods yet"
            description="Add a card so your subscription can renew automatically."
            action={
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4" />
                Add payment method
              </Button>
            }
          />
        )}

        {!isLoading && paymentMethods && paymentMethods.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentMethods.map((method) => (
                <TableRow key={method.id}>
                  <TableCell className="font-medium capitalize">
                    {method.brand ?? method.type.toLowerCase()} •••• {method.last4 ?? "----"}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {method.expMonth && method.expYear
                      ? `${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
                      : "—"}
                  </TableCell>
                  <TableCell>{method.isDefault && <Badge variant="secondary">Default</Badge>}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!method.isDefault && (
                          <DropdownMenuItem onClick={() => handleSetDefault(method.id)}>
                            Make default
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleRemove(method.id)}
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
          </DialogHeader>

          {!stripePromise && (
            <p className="text-sm text-muted-foreground">
              Stripe is not configured in this environment yet — set
              NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to enable adding payment methods.
            </p>
          )}

          {stripePromise && !clientSecret && (
            <div className="flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {stripePromise && clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <StripeSetupForm onConfirmed={handleConfirmed} onCancel={() => setDialogOpen(false)} />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
