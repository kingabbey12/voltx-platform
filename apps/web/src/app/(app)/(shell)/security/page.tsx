"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSecurityPolicy, useUpdateSecurityPolicy } from "@/hooks/use-security";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const formSchema = z.object({
  mfaRequired: z.boolean(),
  minLength: z.coerce.number().int().min(8).max(128),
  requireUppercase: z.boolean(),
  requireNumber: z.boolean(),
  requireSymbol: z.boolean(),
  ipAllowlist: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

function parseLines(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function SecurityPolicyPage() {
  const { data: policy, isLoading } = useSecurityPolicy();
  const updatePolicy = useUpdateSecurityPolicy();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mfaRequired: false,
      minLength: 8,
      requireUppercase: false,
      requireNumber: false,
      requireSymbol: false,
      ipAllowlist: "",
    },
  });

  useEffect(() => {
    if (policy) {
      form.reset({
        mfaRequired: policy.mfaRequired,
        minLength: policy.passwordPolicy.minLength,
        requireUppercase: policy.passwordPolicy.requireUppercase,
        requireNumber: policy.passwordPolicy.requireNumber,
        requireSymbol: policy.passwordPolicy.requireSymbol,
        ipAllowlist: policy.ipAllowlist.join("\n"),
      });
    }
  }, [policy, form]);

  async function onSubmit(values: FormValues) {
    try {
      await updatePolicy.mutateAsync({
        mfaRequired: values.mfaRequired,
        passwordPolicy: {
          minLength: values.minLength,
          requireUppercase: values.requireUppercase,
          requireNumber: values.requireNumber,
          requireSymbol: values.requireSymbol,
        },
        ipAllowlist: parseLines(values.ipAllowlist),
      });
      toast.success("Security policy updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-card bg-secondary/60" />;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Multi-factor authentication</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Require every member of this organization to enroll in MFA.
          </p>
          <FormField
            control={form.control}
            name="mfaRequired"
            render={({ field }) => (
              <FormItem className="mt-4 flex items-center justify-between gap-4">
                <FormLabel className="!mt-0">Require MFA for all members</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">Password policy</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Applies to every new password set within this organization.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="minLength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum length</FormLabel>
                  <FormControl>
                    <Input type="number" min={8} max={128} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="mt-4 flex flex-col gap-3">
            <FormField
              control={form.control}
              name="requireUppercase"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel className="!mt-0">Require an uppercase letter</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireNumber"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel className="!mt-0">Require a number</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="requireSymbol"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4">
                  <FormLabel className="!mt-0">Require a symbol</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-foreground">IP allowlist</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Exact IPs and/or IPv4 CIDR ranges. Leave empty to allow any IP.
          </p>
          <FormField
            control={form.control}
            name="ipAllowlist"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormControl>
                  <Textarea placeholder={"203.0.113.7\n10.0.0.0/8"} {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">One per line.</p>
                <FormMessage />
              </FormItem>
            )}
          />
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={updatePolicy.isPending}>
            Save changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
