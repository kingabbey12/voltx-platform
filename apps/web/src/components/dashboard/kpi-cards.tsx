"use client";

import { Bot, Building2, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useCompanies, useLeads, useOpportunities } from "@/hooks/use-sales";
import { useConversations } from "@/hooks/use-ai";
import { formatCurrency } from "@/lib/format";

interface Kpi {
  label: string;
  value: string;
  icon: LucideIcon;
  isLoading: boolean;
}

export function KpiCards() {
  const { data: opportunities, isLoading: loadingOpps } = useOpportunities({ limit: 100 });
  const { data: companies, isLoading: loadingCompanies } = useCompanies({ limit: 1 });
  const { data: leads, isLoading: loadingLeads } = useLeads({ limit: 1, status: "QUALIFIED" });
  const { data: conversations, isLoading: loadingConversations } = useConversations({ limit: 1 });

  const pipelineValue =
    opportunities?.items
      .filter((o) => o.stage !== "CLOSED_LOST" && o.stage !== "CLOSED_WON")
      .reduce((sum, o) => sum + (o.amount ?? 0), 0) ?? 0;

  const kpis: Kpi[] = [
    {
      label: "Pipeline value",
      value: formatCurrency(pipelineValue),
      icon: TrendingUp,
      isLoading: loadingOpps,
    },
    {
      label: "Companies",
      value: String(companies?.total ?? 0),
      icon: Building2,
      isLoading: loadingCompanies,
    },
    {
      label: "Qualified leads",
      value: String(leads?.total ?? 0),
      icon: Users,
      isLoading: loadingLeads,
    },
    {
      label: "AI conversations",
      value: String(conversations?.total ?? 0),
      icon: Bot,
      isLoading: loadingConversations,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="flex items-center gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
              <kpi.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              {kpi.isLoading ? (
                <div className="mt-1 h-6 w-16 animate-pulse rounded bg-secondary" />
              ) : (
                <p className="truncate text-xl font-semibold tracking-tight">{kpi.value}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
