"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Bot, ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgent, useUpdateAgent } from "@/hooks/use-agents";
import type { AIProviderName, UpdateAgentInput } from "@/lib/api/agents";
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

export default function EditAgentPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params.agentId;

  const { data: agent, isLoading } = useAgent(agentId);
  const updateAgent = useUpdateAgent();

  const [form, setForm] = useState<UpdateAgentInput>({});

  useEffect(() => {
    if (agent) {
      setForm({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        provider: agent.provider,
        model: agent.model,
        configuration: {
          temperature: agent.configuration?.temperature,
          maxOutputTokens: agent.configuration?.maxOutputTokens,
          canDelegate: agent.configuration?.canDelegate,
          toolNames: agent.configuration?.toolNames,
        },
        enabled: agent.enabled,
      });
    }
  }, [agent]);

  function update<K extends keyof UpdateAgentInput>(key: K, value: UpdateAgentInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateConfig<K extends keyof NonNullable<UpdateAgentInput["configuration"]>>(
    key: K,
    value: NonNullable<UpdateAgentInput["configuration"]>[K],
  ) {
    setForm((prev) => ({ ...prev, configuration: { ...prev.configuration, [key]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agentId) return;
    if (form.name !== undefined && !form.name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    try {
      await updateAgent.mutateAsync({ id: agentId, ...form });
      toast.success("Agent updated");
      router.push(`/ai/agents/${agentId}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Agent not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/ai/agents")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit Agent</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update configuration for <strong>{agent.name}</strong>.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                value={form.name ?? ""}
                onChange={(e) => update("name", e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Description</label>
              <input
                type="text"
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">System Prompt</label>
              <textarea
                value={form.systemPrompt ?? ""}
                onChange={(e) => update("systemPrompt", e.target.value)}
                className="h-32 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </CardContent>
        </Card>

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
                  value={form.provider ?? agent.provider}
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
                  value={form.model ?? agent.model}
                  onChange={(e) => update("model", e.target.value)}
                  list="model-suggestions"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
                <datalist id="model-suggestions">
                  {(MODEL_SUGGESTIONS[form.provider ?? agent.provider] ?? []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled ?? agent.enabled}
                onChange={(e) => update("enabled", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-xs font-medium text-muted-foreground">Agent enabled</span>
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
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
                  value={form.configuration?.temperature ?? agent.configuration?.temperature ?? 0.7}
                  onChange={(e) => updateConfig("temperature", parseFloat(e.target.value) || 0)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Max Output Tokens</label>
                <input
                  type="number"
                  min={1}
                  max={32768}
                  value={form.configuration?.maxOutputTokens ?? agent.configuration?.maxOutputTokens ?? 4096}
                  onChange={(e) => updateConfig("maxOutputTokens", parseInt(e.target.value) || 4096)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={form.configuration?.canDelegate ?? agent.configuration?.canDelegate ?? false}
                onChange={(e) => updateConfig("canDelegate", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Allow delegation to sub-agents
            </label>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" isLoading={updateAgent.isPending}>Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
