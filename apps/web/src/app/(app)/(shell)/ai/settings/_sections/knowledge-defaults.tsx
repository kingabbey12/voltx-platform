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

const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "azure-openai", label: "Azure OpenAI" },
];

const schema = z.object({
  embeddingProvider: z.string().optional(),
  chunkSize: z.string().optional(),
  chunkOverlap: z.string().optional(),
  retrievalTopK: z.string().optional(),
  similarityThreshold: z.string().optional(),
  enableReranking: z.boolean().optional(),
});

type Values = z.infer<typeof schema>;

export function KnowledgeDefaultsSection() {
  const { data: settings, isLoading } = useAiSettings();
  const update = useUpdateAiSettings();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      embeddingProvider: "",
      chunkSize: "",
      chunkOverlap: "",
      retrievalTopK: "",
      similarityThreshold: "",
      enableReranking: false,
    },
  });

  useEffect(() => {
    if (!settings?.knowledgeDefaults) return;
    form.reset({
      embeddingProvider:
        settings.knowledgeDefaults.embeddingProvider ?? "",
      chunkSize: settings.knowledgeDefaults.chunkSize?.toString() ?? "",
      chunkOverlap:
        settings.knowledgeDefaults.chunkOverlap?.toString() ?? "",
      retrievalTopK:
        settings.knowledgeDefaults.retrievalTopK?.toString() ?? "",
      similarityThreshold:
        settings.knowledgeDefaults.similarityThreshold?.toString() ?? "",
      enableReranking:
        settings.knowledgeDefaults.enableReranking ?? false,
    });
  }, [settings, form]);

  async function onSubmit(values: Values) {
    try {
      await update.mutateAsync({
        knowledgeDefaults: {
          embeddingProvider:
            values.embeddingProvider || undefined,
          chunkSize: values.chunkSize
            ? parseInt(values.chunkSize, 10)
            : undefined,
          chunkOverlap: values.chunkOverlap
            ? parseInt(values.chunkOverlap, 10)
            : undefined,
          retrievalTopK: values.retrievalTopK
            ? parseInt(values.retrievalTopK, 10)
            : undefined,
          similarityThreshold: values.similarityThreshold
            ? parseFloat(values.similarityThreshold)
            : undefined,
          enableReranking: values.enableReranking || undefined,
        },
      });
      toast.success("Knowledge defaults updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Knowledge Defaults</h2>
        <p className="text-sm text-muted-foreground">
          Default settings for document ingestion and retrieval.
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
                name="embeddingProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Embedding provider</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROVIDER_OPTIONS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="chunkSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chunk size</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
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
                  name="chunkOverlap"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chunk overlap</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="200"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="retrievalTopK"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retrieval top K</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="5"
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
                  name="similarityThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Similarity threshold</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.05"
                          min="0"
                          max="1"
                          placeholder="0.7"
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
                name="enableReranking"
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
                      <FormLabel className="!mt-0">
                        Enable reranking
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <div className="pt-2">
                <Button type="submit" isLoading={update.isPending}>
                  Save knowledge defaults
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
