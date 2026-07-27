"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useAiSettings, useUpdateAiSettings } from "@/hooks/use-ai-settings";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const schema = z.object({
  parallelExecution: z.boolean().optional(),
  retryMaxAttempts: z.string().optional(),
  retryBackoffMs: z.string().optional(),
  requireApproval: z.boolean().optional(),
  executionTimeoutMs: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function WorkflowDefaultsSection() {
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      parallelExecution: false,
      retryMaxAttempts: "",
      retryBackoffMs: "",
      requireApproval: false,
      executionTimeoutMs: "",
    },
  });

  useEffect(() => {
    if (!settings?.workflowDefaults) return;
    form.reset({
      parallelExecution:
        settings.workflowDefaults.parallelExecution ?? false,
      retryMaxAttempts:
        settings.workflowDefaults.retryMaxAttempts?.toString() ?? "",
      retryBackoffMs:
        settings.workflowDefaults.retryBackoffMs?.toString() ?? "",
      requireApproval:
        settings.workflowDefaults.requireApproval ?? false,
      executionTimeoutMs:
        settings.workflowDefaults.executionTimeoutMs?.toString() ?? "",
    });
  }, [settings, form]);

  async function onSubmit(values: Values) {
    try {
      await update.mutateAsync({
        workflowDefaults: {
          parallelExecution: values.parallelExecution || undefined,
          retryMaxAttempts: values.retryMaxAttempts
            ? parseInt(values.retryMaxAttempts, 10)
            : undefined,
          retryBackoffMs: values.retryBackoffMs
            ? parseInt(values.retryBackoffMs, 10)
            : undefined,
          requireApproval: values.requireApproval || undefined,
          executionTimeoutMs: values.executionTimeoutMs
            ? parseInt(values.executionTimeoutMs, 10)
            : undefined,
        },
      });
      toast.success("Workflow defaults updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Workflow Defaults</h2>
        <p className="text-sm text-muted-foreground">
          Default settings applied to all new workflows.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="parallelExecution"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="!mt-0">
                          Parallel execution
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Run independent steps in parallel when possible.
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="requireApproval"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-3">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <div>
                        <FormLabel className="!mt-0">
                          Require approval on every run
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Pause workflows before execution for human review.
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="retryMaxAttempts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retry max attempts</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="3"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retryBackoffMs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retry backoff (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="1000"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="executionTimeoutMs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Execution timeout (ms)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="600000"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button type="submit" isLoading={update.isPending}>
                  Save workflow defaults
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
