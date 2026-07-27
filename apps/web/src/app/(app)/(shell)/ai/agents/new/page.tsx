"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateAgent } from "@/hooks/use-agents";
import type { AIProviderName, CreateAgentInput } from "@/lib/api/agents";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const PROVIDERS: { value: AIProviderName; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "google", label: "Google" },
  { value: "xai", label: "xAI" },
  { value: "groq", label: "Groq" },
  { value: "mistral", label: "Mistral" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "ollama", label: "Ollama" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "azure-openai", label: "Azure OpenAI" },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openai: ["gpt-5-mini", "gpt-5", "gpt-4o", "gpt-4o-mini"],
  anthropic: ["claude-sonnet-4", "claude-5", "claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
  google: ["gemini-2.0-flash", "gemini-2.0-pro", "gemini-1.5-pro"],
  xai: ["grok-2", "grok-3"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "mistral-7b"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  ollama: ["llama3.2", "mistral", "codellama"],
  openrouter: ["auto"],
  "azure-openai": ["gpt-5-mini", "gpt-4o"],
};

export default function CreateAgentPage() {
  const router = useRouter();
  const createAgent = useCreateAgent();

  const [form, setForm] = useState<CreateAgentInput>({
    name: "",
    description: "",
    systemPrompt: "",
    provider: "openai",
    model: "gpt-5-mini",
    configuration: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      canDelegate: false,
    },
    enabled: true,
  });

  function update<K extends keyof CreateAgentInput>(key: K, value: CreateAgentInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateConfig<K extends keyof NonNullable<CreateAgentInput["configuration"]>>(
    key: K,
    value: NonNullable<CreateAgentInput["configuration"]>[K],
  ) {
    setForm((prev) => ({ ...prev, configuration: { ...prev.configuration, [key]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
      toast.error("Name, description, and system prompt are required");
      return;
    }
    try {
      const agent = await createAgent.mutateAsync(form);
      toast.success("Agent created");
      router.push(`/ai/agents/${agent.id}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Create Agent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure a new AI agent with a system prompt and provider settings.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Sales Assistant Pro"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="e.g. Helps sales team qualify leads and draft proposals"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                System Prompt
                <span className="ml-1 text-muted-foreground/60">(instructions the agent follows)</span>
              </label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => update("systemPrompt", e.target.value)}
                placeholder="You are a helpful sales assistant that helps qualify leads, draft emails, and manage opportunities..."
                className="h-32 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </CardContent>
        </Card>

        {/* Provider & Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Provider &amp; Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Provider</label>
                <select
                  value={form.provider}
                  onChange={(e) => {
                    const provider = e.target.value as AIProviderName;
                    update("provider", provider);
                    const suggestions = MODEL_SUGGESTIONS[provider];
                    if (suggestions && suggestions.length > 0) {
                      update("model", suggestions[0]);
                    }
                  }}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Model</label>
                <input
                  type="text"
                  value={form.model ?? ""}
                  onChange={(e) => update("model", e.target.value)}
                  placeholder="e.g. gpt-5-mini"
                  list="model-suggestions"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
                <datalist id="model-suggestions">
                  {(MODEL_SUGGESTIONS[form.provider ?? "openai"] ?? []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Temperature
                  <span className="ml-1 text-muted-foreground/60">(0-2)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.configuration?.temperature ?? 0.7}
                  onChange={(e) => updateConfig("temperature", parseFloat(e.target.value) || 0)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Max Output Tokens
                </label>
                <input
                  type="number"
                  min={1}
                  max={32768}
                  step={1}
                  value={form.configuration?.maxOutputTokens ?? 4096}
                  onChange={(e) => updateConfig("maxOutputTokens", parseInt(e.target.value) || 4096)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.enabled ?? true}
                    onChange={(e) => update("enabled", e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-xs font-medium text-muted-foreground">Enable on creation</span>
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.configuration?.canDelegate ?? false}
                  onChange={(e) => updateConfig("canDelegate", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Allow delegation to sub-agents
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={createAgent.isPending}>Create Agent</Button>
        </div>
      </form>
    </div>
  );
}
