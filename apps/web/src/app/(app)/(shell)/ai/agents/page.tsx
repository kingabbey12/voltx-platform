"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bot,
  Plus,
  Search,
  MoreHorizontal,
  Power,
  PowerOff,
  Pencil,
  Trash2,
  Play,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAgents, useUpdateAgent, useDeleteAgent } from "@/hooks/use-agents";
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

export default function AgentsListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [enabledFilter, setEnabledFilter] = useState<boolean | undefined>(undefined);

  const deferredSearch = useDeferredValue(searchQuery);
  const { data, isLoading } = useAgents({ search: deferredSearch || undefined, limit: 50, enabled: enabledFilter });
  const updateAgent = useUpdateAgent();
  const deleteAgent = useDeleteAgent();

  async function handleToggleEnabled(agent: { id: string; enabled: boolean }) {
    try {
      await updateAgent.mutateAsync({ id: agent.id, enabled: !agent.enabled });
      toast.success(agent.enabled ? "Agent disabled" : "Agent enabled");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteAgent.mutateAsync(deleteId);
      setDeleteId(null);
      toast.success("Agent deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const agents = data?.items ?? [];

  return (
    <div className="relative mx-auto max-w-[1400px] space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_16%_0%,hsl(268_83%_68%/0.10),transparent_46%),radial-gradient(ellipse_at_82%_10%,hsl(var(--primary)/0.08),transparent_40%)]" />
      <div className="surface-raised relative overflow-hidden rounded-[24px] p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[hsl(268_83%_68%/0.14)] blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(268_83%_68%/0.28)] bg-[hsl(268_83%_68%/0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-[hsl(268_83%_76%)]"><Sparkles className="h-3.5 w-3.5" />AI workforce</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">AI Agents</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Your configured agents, their live availability, and the controls to run work safely.</p>
        </div>
        <Link href="/ai/agents/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </Link>
      </div></div>

      {/* Filters */}
      <div className="surface-widget flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Agent directory</p><p className="mt-1 text-sm text-muted-foreground">{data?.total ?? 0} configured agents</p></div>
        <div className="flex w-full items-center gap-3 sm:w-auto">
        <div className="relative flex-1 sm:w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="h-10 w-full rounded-xl border border-white/[0.09] bg-black/25 pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <select
          value={enabledFilter === undefined ? "all" : enabledFilter ? "enabled" : "disabled"}
          onChange={(e) => {
            if (e.target.value === "all") setEnabledFilter(undefined);
            else setEnabledFilter(e.target.value === "enabled");
          }}
          className="h-10 rounded-xl border border-white/[0.09] bg-black/25 px-3 text-sm outline-none focus:border-primary/50"
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div></div>

      {/* List */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-40 rounded-[24px]" />
          ))}
        </div>
      )}

      {!isLoading && agents.length === 0 && (
        <Card className="surface-widget rounded-[24px]">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "No agents match this search" : "Build your AI workforce"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">
                {searchQuery ? "Try a more specific agent name, provider, or capability." : "Create an agent when a repeatable business workflow needs dedicated intelligence."}
              </p>
            </div>
            {!searchQuery && (
              <Link href="/ai/agents/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  New Agent
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {agents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const providerKey = agent.provider?.toLowerCase();
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card variant="interactive" className="group relative min-h-[218px] overflow-hidden rounded-[24px] border-white/[0.08]">
                  <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[hsl(268_83%_68%/0.10)] blur-3xl transition-transform duration-300 group-hover:scale-125" />
                  <CardContent className="relative flex h-full flex-col p-5">
                    <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                        agent.enabled ? "border-primary/20 bg-primary/10 text-primary shadow-[0_10px_24px_-18px_hsl(var(--primary)/0.9)]" : "border-white/[0.07] bg-white/[0.035] text-muted-foreground",
                      )}
                    >
                      <Bot className="h-5 w-5" />
                    </div>

                    <Link href={`/ai/agents/${agent.id}`} className="min-w-0 flex-1 rounded-lg focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{agent.name}</p>
                        {!agent.enabled && (
                          <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {agent.description || "Purpose has not been described yet."}
                      </p>
                    </Link>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild>
                          <Link href={`/ai/agents/${agent.id}`}>
                            <Bot className="h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/ai/agents/${agent.id}/run`}>
                            <Play className="h-4 w-4" />
                            Run
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleEnabled(agent)}>
                          {agent.enabled ? (
                            <><PowerOff className="h-4 w-4" />Disable</>
                          ) : (
                            <><Power className="h-4 w-4" />Enable</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/ai/agents/${agent.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(agent.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Model</p><p className="mt-1 truncate text-xs text-foreground/80">{agent.model}</p></div>{providerKey && PROVIDER_COLORS[providerKey] && <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-1 text-[11px] font-medium", PROVIDER_COLORS[providerKey])}><Sparkles className="mr-1 h-3 w-3" />{agent.provider}</span>}</div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              This will permanently delete this agent and all its run history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} isLoading={deleteAgent.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
