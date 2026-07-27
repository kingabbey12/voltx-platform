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
import { useAiSettings, useUpdateAiSettings } from "@/hooks/use-ai-settings";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const schema = z.object({
  temperature: z.string().optional(),
  topP: z.string().optional(),
  maxTokens: z.string().optional(),
  contextWindow: z.string().optional(),
  retryMaxAttempts: z.string().optional(),
  retryBackoffMs: z.string().optional(),
  timeoutMs: z.string().optional(),
  monthlyCostLimitUsd: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function AgentDefaultsSection() {
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      temperature: "",
      topP: "",
      maxTokens: "",
      contextWindow: "",
      retryMaxAttempts: "",
      retryBackoffMs: "",
      timeoutMs: "",
      monthlyCostLimitUsd: "",
    },
  });

  useEffect(() => {
    if (!settings?.agentDefaults) return;
    form.reset({
      temperature: settings.agentDefaults.temperature?.toString() ?? "",
      topP: settings.agentDefaults.topP?.toString() ?? "",
      maxTokens: settings.agentDefaults.maxTokens?.toString() ?? "",
      contextWindow: settings.agentDefaults.contextWindow?.toString() ?? "",
      retryMaxAttempts:
        settings.agentDefaults.retryMaxAttempts?.toString() ?? "",
      retryBackoffMs:
        settings.agentDefaults.retryBackoffMs?.toString() ?? "",
      timeoutMs: settings.agentDefaults.timeoutMs?.toString() ?? "",
      monthlyCostLimitUsd:
        settings.agentDefaults.monthlyCostLimitUsd?.toString() ?? "",
    });
  }, [settings, form]);

  async function onSubmit(values: Values) {
    try {
      await update.mutateAsync({
        agentDefaults: {
          temperature: values.temperature
            ? parseFloat(values.temperature)
            : undefined,
          topP: values.topP ? parseFloat(values.topP) : undefined,
          maxTokens: values.maxTokens
            ? parseInt(values.maxTokens, 10)
            : undefined,
          contextWindow: values.contextWindow
            ? parseInt(values.contextWindow, 10)
            : undefined,
          retryMaxAttempts: values.retryMaxAttempts
            ? parseInt(values.retryMaxAttempts, 10)
            : undefined,
          retryBackoffMs: values.retryBackoffMs
            ? parseInt(values.retryBackoffMs, 10)
            : undefined,
          timeoutMs: values.timeoutMs
            ? parseInt(values.timeoutMs, 10)
            : undefined,
          monthlyCostLimitUsd: values.monthlyCostLimitUsd
            ? parseFloat(values.monthlyCostLimitUsd)
            : undefined,
        },
      });
      toast.success("Agent defaults updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Agent Defaults</h2>
        <p className="text-sm text-muted-foreground">
          Default parameters applied to all new AI agents.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        placeholder="0.7"
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
                name="topP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Top P</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        placeholder="0.9"
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
                name="maxTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max tokens</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="4096"
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
                name="contextWindow"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Context window</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="128000"
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
              <FormField
                control={form.control}
                name="timeoutMs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeout (ms)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="300000"
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
                name="monthlyCostLimitUsd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly cost limit ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="100"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2 pt-2">
                <Button type="submit" isLoading={update.isPending}>
                  Save agent defaults
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
