"use client";

import { Sparkles, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiPerformance } from "@/hooks/use-ai-dashboard";

export function TopAgentsWidget() {
  const { data, isLoading } = useAiPerformance(30);

  const agents = data?.byAgent ?? [];
  const sorted = [...agents].sort((a, b) => b.callCount - a.callCount).slice(0, 5);
  const maxCalls = sorted.length > 0 ? Math.max(...sorted.map((a) => a.callCount)) : 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4" />
          Top Agents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}
        {!isLoading && sorted.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No agent activity yet</p>
          </div>
        )}
        {sorted.length > 0 && (
          <div className="space-y-3">
            {sorted.map((entry) => (
              <div key={entry.agentId ?? "none"} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{entry.agentName ?? "Direct chat"}</span>
                  <span className="text-muted-foreground">{entry.callCount} calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(entry.callCount / maxCalls) * 100}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    <DollarSign className="inline h-3 w-3" />
                    {entry.totalCostUsd.toFixed(4)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
