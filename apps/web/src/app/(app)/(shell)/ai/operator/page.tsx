"use client";

import dynamic from "next/dynamic";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AiUsageMetrics } from "./_widgets/ai-usage-metrics";
import { ActiveAgentsWidget } from "./_widgets/active-agents";
import { PendingApprovalsWidget } from "./_widgets/pending-approvals";
import { RunningWorkflowsWidget } from "./_widgets/running-workflows";
import { RecentActivityWidget } from "./_widgets/recent-activity";
import { TopAgentsWidget } from "./_widgets/top-agents";
import { KnowledgeHealthWidget } from "./_widgets/knowledge-health";
import { QuickActionsWidget } from "./_widgets/quick-actions";
import { RecentConversationsWidget } from "./_widgets/recent-conversations";
import { NotificationsWidget } from "./_widgets/notifications";

const DailyBriefWidget = dynamic(
  () => import("./_widgets/daily-brief").then((m) => ({ default: m.DailyBriefWidget })),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-xl bg-secondary/60 lg:col-span-2" /> },
);

export default function AiOperatorDashboardPage() {
  const queryClient = useQueryClient();

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["ai", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    queryClient.invalidateQueries({ queryKey: ["agents"] });
    queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Operator</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time overview of agents, usage, approvals, and system health.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Daily Brief */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DailyBriefWidget />
        <div className="flex flex-col gap-6">
          <PendingApprovalsWidget />
          <RunningWorkflowsWidget />
        </div>
      </div>

      {/* AI Usage Metrics */}
      <AiUsageMetrics />

      {/* Middle row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <ActiveAgentsWidget />
        <RecentConversationsWidget />
        <TopAgentsWidget />
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <KnowledgeHealthWidget />
        <NotificationsWidget />
        <QuickActionsWidget />
      </div>

      {/* Activity */}
      <RecentActivityWidget />
    </div>
  );
}
