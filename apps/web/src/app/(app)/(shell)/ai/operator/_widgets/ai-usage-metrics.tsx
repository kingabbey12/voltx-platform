"use client";

import { Activity, Timer, DollarSign, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAiPerformance } from "@/hooks/use-ai-dashboard";

function MetricTile({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3.5">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color ?? "bg-primary/10"}`}>
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AiUsageMetrics() {
  const { data, isLoading } = useAiPerformance(30);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricTile
        icon={Activity}
        label="AI Calls (30d)"
        value={data ? data.totalCallCount.toLocaleString() : "\u2014"}
        color="bg-blue-500/10"
      />
      <MetricTile
        icon={Bot}
        label="Tokens Used"
        value={data ? data.totalTokens.toLocaleString() : "\u2014"}
        color="bg-violet-500/10"
      />
      <MetricTile
        icon={DollarSign}
        label="Cost (30d)"
        value={data ? `$${data.totalCostUsd.toFixed(2)}` : "\u2014"}
        color="bg-rose-500/10"
      />
      <MetricTile
        icon={Timer}
        label="Avg per Call"
        value={data && data.totalCallCount > 0
          ? `$${(data.totalCostUsd / data.totalCallCount).toFixed(4)}`
          : "\u2014"
        }
        color="bg-amber-500/10"
      />
    </div>
  );
}
