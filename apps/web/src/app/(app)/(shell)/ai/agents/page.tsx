"use client";

import { useState } from "react";
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

  const { data, isLoading } = useAgents({ search: searchQuery || undefined, limit: 50, enabled: enabledFilter });
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
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure and manage AI agents that can execute tasks autonomously.
          </p>
        </div>
        <Link href="/ai/agents/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>
        <select
          value={enabledFilter === undefined ? "all" : enabledFilter ? "enabled" : "disabled"}
          onChange={(e) => {
            if (e.target.value === "all") setEnabledFilter(undefined);
            else setEnabledFilter(e.target.value === "enabled");
          }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
        >
          <option value="all">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* List */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary/60" />
          ))}
        </div>
      )}

      {!isLoading && agents.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Bot className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "No agents match your search" : "No agents yet"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/60">
                {searchQuery ? "Try a different search term." : "Create your first AI agent to start automating tasks."}
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
        <div className="space-y-3">
          {agents.map((agent) => {
            const providerKey = agent.provider?.toLowerCase();
            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="transition-shadow hover:shadow-sm">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        agent.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Bot className="h-5 w-5" />
                    </div>

                    <Link href={`/ai/agents/${agent.id}`} className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{agent.name}</p>
                        {!agent.enabled && (
                          <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {agent.description || "No description"}
                      </p>
                    </Link>

                    <div className="hidden items-center gap-3 sm:flex">
                      {providerKey && PROVIDER_COLORS[providerKey] && (
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", PROVIDER_COLORS[providerKey])}>
                          <Sparkles className="mr-1 h-3 w-3" />
                          {agent.provider}
                        </span>
                      )}
                      <span className="text-[11px] text-muted-foreground">{agent.model}</span>
                    </div>

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
