"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAiSettings, useUpdateAiSettings } from "@/hooks/use-ai-settings";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const schema = z.object({
  loggingLevel: z.string().optional(),
  streamingEnabled: z.boolean().optional(),
  backgroundJobsEnabled: z.boolean().optional(),
  cacheTtlMs: z.string().optional(),
});

type Values = z.infer<typeof schema>;

const KNOWN_FEATURE_FLAGS = [
  "agent_self_correction",
  "memory_long_term",
  "tool_approval_workflow",
  "multi_agent_orchestration",
  "knowledge_graph_search",
  "streaming_token_by_token",
  "reasoning_budget",
  "image_generation",
];

export function SystemSection() {
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const [featureFlags, setFeatureFlags] = useState<string[]>([]);
  const [newFlag, setNewFlag] = useState("");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      loggingLevel: "",
      streamingEnabled: true,
      backgroundJobsEnabled: true,
      cacheTtlMs: "",
    },
  });

  useEffect(() => {
    if (!settings?.system) return;
    form.reset({
      loggingLevel: settings.system.loggingLevel ?? "",
      streamingEnabled: settings.system.streamingEnabled ?? true,
      backgroundJobsEnabled:
        settings.system.backgroundJobsEnabled ?? true,
      cacheTtlMs: settings.system.cacheTtlMs?.toString() ?? "",
    });
    setFeatureFlags(settings.system.featureFlags ?? []);
  }, [settings, form]);

  async function onSubmit(values: Values) {
    try {
      await update.mutateAsync({
        system: {
          loggingLevel:
            (values.loggingLevel as
              | "debug"
              | "info"
              | "warn"
              | "error"
              | undefined) || undefined,
          streamingEnabled:
            values.streamingEnabled || undefined,
          backgroundJobsEnabled:
            values.backgroundJobsEnabled || undefined,
          cacheTtlMs: values.cacheTtlMs
            ? parseInt(values.cacheTtlMs, 10)
            : undefined,
          featureFlags:
            featureFlags.length > 0 ? featureFlags : undefined,
        },
      });
      toast.success("System settings updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function toggleFlag(flag: string) {
    setFeatureFlags((prev) =>
      prev.includes(flag)
        ? prev.filter((f) => f !== flag)
        : [...prev, flag],
    );
  }

  function addCustomFlag() {
    const flag = newFlag.trim();
    if (!flag) return;
    if (featureFlags.includes(flag)) return;
    setFeatureFlags((prev) => [...prev, flag]);
    setNewFlag("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">System</h2>
        <p className="text-sm text-muted-foreground">
          Global AI system configuration and feature flags.
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
                name="loggingLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logging level</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="info" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="streamingEnabled"
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
                          Streaming responses
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Enable token-by-token streaming for chat
                          responses.
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="backgroundJobsEnabled"
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
                          Background jobs
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Enable background processing for agents and
                          workflows.
                        </p>
                      </div>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cacheTtlMs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cache TTL (ms)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        placeholder="3600000"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      How long to cache model responses. 0 = disabled.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Feature flags */}
              <div className="space-y-3 pt-2">
                <FormLabel>Feature flags</FormLabel>
                <p className="text-xs text-muted-foreground">
                  Toggle experimental features.
                </p>
                <div className="flex flex-wrap gap-2">
                  {KNOWN_FEATURE_FLAGS.map((flag) => {
                    const active = featureFlags.includes(flag);
                    return (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => toggleFlag(flag)}
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-muted-foreground/30"
                        }`}
                      >
                        {flag.replace(/_/g, " ")}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newFlag}
                    onChange={(e) => setNewFlag(e.target.value)}
                    placeholder="custom_feature_flag"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomFlag();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomFlag}
                  >
                    Add flag
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" isLoading={update.isPending}>
                  Save system settings
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
