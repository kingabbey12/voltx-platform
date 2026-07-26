"use client";

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

const modelSchema = z.object({
  chat: z.string().optional(),
  agent: z.string().optional(),
  embedding: z.string().optional(),
  reasoning: z.string().optional(),
});

type ModelValues = z.infer<typeof modelSchema>;

const KNOWN_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "o3",
    "o4-mini",
    "text-embedding-3-large",
    "text-embedding-3-small",
  ],
  anthropic: [
    "claude-sonnet-4-20250514",
    "claude-haiku-3-5-20241022",
  ],
  google: [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "text-embedding-004",
  ],
};

export function ModelsSection() {
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const form = useForm<ModelValues>({
    resolver: zodResolver(modelSchema),
    values: {
      chat: settings?.models?.chat ?? "",
      agent: settings?.models?.agent ?? "",
      embedding: settings?.models?.embedding ?? "",
      reasoning: settings?.models?.reasoning ?? "",
    },
  });

  async function onSubmit(values: ModelValues) {
    try {
      await update.mutateAsync({
        models: {
          chat: values.chat || undefined,
          agent: values.agent || undefined,
          embedding: values.embedding || undefined,
          reasoning: values.reasoning || undefined,
        },
      });
      toast.success("Default models updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Default Models</h2>
        <p className="text-sm text-muted-foreground">
          Choose the default model for each category.
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
                name="chat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default chat model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="gpt-4o"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Used for standard conversations and AI chat.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="agent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default agent model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="gpt-4o"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Used for autonomous agent runs and tool use.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="embedding"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default embedding model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="text-embedding-3-large"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Used for knowledge retrieval and semantic search.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reasoning"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default reasoning model</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="o3"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Used for complex reasoning and multi-step analysis.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button type="submit" isLoading={update.isPending}>
                  Save model defaults
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Common model IDs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(KNOWN_MODELS).map(([provider, models]) => (
              <div key={provider}>
                <p className="text-xs font-medium capitalize mb-1">
                  {provider}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        form.setValue("chat", m);
                        form.handleSubmit(onSubmit)();
                      }}
                      className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
