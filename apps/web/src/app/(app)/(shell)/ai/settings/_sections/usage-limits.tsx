"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAiSettings, useUpdateAiSettings } from "@/hooks/use-ai-settings";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const schema = z.object({
  dailyTokenLimit: z.string().optional(),
  monthlyBudgetUsd: z.string().optional(),
  perUserDailyQuota: z.string().optional(),
  perOrgMonthlyQuota: z.string().optional(),
  rateLimitPerMinute: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function UsageLimitsSection() {
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      dailyTokenLimit: "",
      monthlyBudgetUsd: "",
      perUserDailyQuota: "",
      perOrgMonthlyQuota: "",
      rateLimitPerMinute: "",
    },
  });

  useEffect(() => {
    if (!settings?.usageLimits) return;
    form.reset({
      dailyTokenLimit:
        settings.usageLimits.dailyTokenLimit?.toString() ?? "",
      monthlyBudgetUsd:
        settings.usageLimits.monthlyBudgetUsd?.toString() ?? "",
      perUserDailyQuota:
        settings.usageLimits.perUserDailyQuota?.toString() ?? "",
      perOrgMonthlyQuota:
        settings.usageLimits.perOrgMonthlyQuota?.toString() ?? "",
      rateLimitPerMinute:
        settings.usageLimits.rateLimitPerMinute?.toString() ?? "",
    });
  }, [settings, form]);

  async function onSubmit(values: Values) {
    try {
      await update.mutateAsync({
        usageLimits: {
          dailyTokenLimit: values.dailyTokenLimit
            ? parseInt(values.dailyTokenLimit, 10)
            : undefined,
          monthlyBudgetUsd: values.monthlyBudgetUsd
            ? parseFloat(values.monthlyBudgetUsd)
            : undefined,
          perUserDailyQuota: values.perUserDailyQuota
            ? parseInt(values.perUserDailyQuota, 10)
            : undefined,
          perOrgMonthlyQuota: values.perOrgMonthlyQuota
            ? parseInt(values.perOrgMonthlyQuota, 10)
            : undefined,
          rateLimitPerMinute: values.rateLimitPerMinute
            ? parseInt(values.rateLimitPerMinute, 10)
            : undefined,
        },
      });
      toast.success("Usage limits updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Usage & Limits</h2>
        <p className="text-sm text-muted-foreground">
          Control token consumption, budgets, and rate limits.
        </p>
      </div>

      {/* Current usage summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Current period usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Tokens used</p>
              <p className="text-lg font-semibold">—</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Spend</p>
              <p className="text-lg font-semibold">—</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">API calls</p>
              <p className="text-lg font-semibold">—</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active users</p>
              <p className="text-lg font-semibold">—</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Limits form */}
      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dailyTokenLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily token limit</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="1000000"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Max tokens per day across the org.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monthlyBudgetUsd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly budget ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="500"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Max spend per month across the org.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="perUserDailyQuota"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Per-user daily quota</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="50000"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Max tokens per user per day.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="perOrgMonthlyQuota"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Per-org monthly quota</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="5000000"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Max tokens per org per month.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="rateLimitPerMinute"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate limit (requests/minute)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="60"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Max API requests per minute.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button type="submit" isLoading={update.isPending}>
                  Save usage limits
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
