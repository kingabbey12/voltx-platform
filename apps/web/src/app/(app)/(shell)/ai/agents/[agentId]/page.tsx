"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Bot,
  ArrowLeft,
  Play,
  Pencil,
  Trash2,
  BarChart3,
  History,
  Sparkles,
  Power,
  PowerOff,
  Loader2,
  Terminal,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAgent, useAgentStats, useUpdateAgent, useDeleteAgent } from "@/hooks/use-agents";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  anthropic: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  google: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  xai: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  groq: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  mistral: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  deepseek: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
};

export default function AgentDetailsPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params.agentId;

  const { data: agent, isLoading } = useAgent(agentId);
  const { data: stats } = useAgentStats(agentId);
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleToggleEnabled() {
    if (!agent) return;
    try {
      await updateAgent.mutateAsync({ id: agent.id, enabled: !agent.enabled });
      toast.success(agent.enabled ? "Agent disabled" : "Agent enabled");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!agent) return;
    try {
      await deleteAgent.mutateAsync(agent.id);
      toast.success("Agent deleted");
      router.push("/ai/agents");
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
        <Link href="/ai/agents">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to Agents
          </Button>
        </Link>
      </div>
    );
  }

  const providerKey = agent.provider?.toLowerCase();
  const successRate = stats ? (stats.succeededRunCount / Math.max(stats.totalRunCount, 1)) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{agent.name}</h1>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                  agent.enabled
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {agent.enabled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {agent.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleToggleEnabled} isLoading={updateAgent.isPending}>
              {agent.enabled ? <><PowerOff className="h-4 w-4" />Disable</> : <><Power className="h-4 w-4" />Enable</>}
            </Button>
            <Link href={`/ai/agents/${agent.id}/run`}>
              <Button size="sm">
                <Play className="h-4 w-4" />
                Run
              </Button>
            </Link>
            <Link href={`/ai/agents/${agent.id}/edit`}>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            </Link>
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Runs</p>
                <p className="text-lg font-semibold">{stats.totalRunCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Succeeded</p>
                <p className="text-lg font-semibold">{stats.succeededRunCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <BarChart3 className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-lg font-semibold">{successRate.toFixed(0)}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Terminal className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tools</p>
                <p className="text-lg font-semibold">{stats.toolCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detail sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Provider &amp; Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Provider</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", providerKey && PROVIDER_COLORS[providerKey])}>
                {agent.provider}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Model</span>
              <span className="font-medium">{agent.model}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Temperature</span>
              <span className="font-medium">{agent.configuration?.temperature ?? 0.7}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Max Tokens</span>
              <span className="font-medium">{agent.configuration?.maxOutputTokens ?? 4096}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Kind</span>
              <span className="font-medium">{agent.configuration?.kind ?? "custom"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Delegation</span>
              <span className="font-medium">{agent.configuration?.canDelegate ? "Allowed" : "Not allowed"}</span>
            </div>
            {agent.configuration?.toolNames && agent.configuration.toolNames.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Tools</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.configuration.toolNames.map((tool) => (
                    <span key={tool} className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Created</span>
              <span className="font-medium">{new Date(agent.createdAt).toLocaleDateString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">System Prompt</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
            {agent.systemPrompt}
          </pre>
        </CardContent>
      </Card>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link href={`/ai/agents/${agent.id}/run`}>
          <Button variant="outline">
            <Play className="h-4 w-4" />
            Run Agent
          </Button>
        </Link>
        <Link href={`/ai/agents/${agent.id}/runs`}>
          <Button variant="outline">
            <History className="h-4 w-4" />
            Run History
          </Button>
        </Link>
        <Link href={`/ai/agents/${agent.id}/analytics`}>
          <Button variant="outline">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Button>
        </Link>
      </div>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{agent.name}</strong> and all its run history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={deleteAgent.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
