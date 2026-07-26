"use client";

import { Bot, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/use-agents";

export function ActiveAgentsWidget() {
  const { data, isLoading } = useAgents({ limit: 100 });

  const agents = data?.items ?? [];
  const enabled = agents.filter((a) => a.enabled);
  const recent = agents.slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4" />
          Active Agents
        </CardTitle>
        {!isLoading && (
          <span className="text-xs text-muted-foreground">
            {enabled.length}/{agents.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}
        {!isLoading && agents.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Bot className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No agents configured</p>
            <Link href="/ai/agents/new">
              <Button size="sm" variant="outline" className="h-7 text-xs">Create Agent</Button>
            </Link>
          </div>
        )}
        {recent.length > 0 && (
          <div className="space-y-1">
            {recent.map((agent) => (
              <Link
                key={agent.id}
                href={`/ai/agents/${agent.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
              >
                {agent.enabled ? (
                  <Power className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="truncate flex-1">{agent.name}</span>
                <span className="text-[11px] text-muted-foreground">{agent.model}</span>
              </Link>
            ))}
            {agents.length > 5 && (
              <Link
                href="/ai/agents"
                className="block rounded-lg px-2 py-1 text-center text-xs text-muted-foreground transition-colors hover:bg-secondary"
              >
                View all {agents.length} agents
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
