"use client";

import Link from "next/link";
import { Activity, AlertTriangle, Building2, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlatformRevenueSummary, usePlatformSystemHealth } from "@/hooks/use-platform";
import { formatCount, formatCurrency } from "@/lib/format";

function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-7 w-24 animate-pulse rounded bg-secondary/60" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

const DEPENDENCY_VARIANT: Record<string, "success" | "destructive"> = {
  up: "success",
  down: "destructive",
};

export default function PlatformConsolePage() {
  const { data: revenue, isLoading: revenueLoading } = usePlatformRevenueSummary();
  const { data: health, isLoading: healthLoading } = usePlatformSystemHealth();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Platform Console</h1>
          <p className="text-sm text-muted-foreground">
            Cross-organization revenue, system health, and Customer Success tools.
          </p>
        </div>
        <Link
          href="/platform/organizations"
          className="text-sm font-medium text-primary hover:underline"
        >
          Search organizations →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={DollarSign}
          label="Estimated MRR"
          value={formatCurrency(revenue?.estimatedMonthlyRecurringRevenueUsd ?? 0)}
          isLoading={revenueLoading}
        />
        <StatCard
          icon={Activity}
          label="Revenue collected"
          value={formatCurrency(revenue?.totalRevenueCollectedUsd ?? 0)}
          isLoading={revenueLoading}
        />
        <StatCard
          icon={AlertTriangle}
          label="Outstanding balance"
          value={formatCurrency(revenue?.outstandingAmountDueUsd ?? 0)}
          isLoading={revenueLoading}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-sm font-medium">System health</CardTitle>
        </CardHeader>
        <CardContent>
          {healthLoading && <div className="h-16 animate-pulse rounded-lg bg-secondary/60" />}
          {!healthLoading && health && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                {Object.entries(health.dependencies).map(([name, dependency]) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="capitalize text-muted-foreground">{name}</span>
                    <Badge variant={DEPENDENCY_VARIANT[dependency.status] ?? "secondary"}>
                      {dependency.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{dependency.latencyMs}ms</span>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Comms delivery (last 24h)
                </p>
                <p className="mt-1 text-sm">
                  {formatCount(health.commsDelivery.totalMessages)} messages,{" "}
                  {(health.commsDelivery.failureRate * 100).toFixed(1)}% failed
                </p>
              </div>

              {health.queues.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Queue backlogs</p>
                  <div className="mt-1 flex flex-col gap-1">
                    {health.queues.map((queue) => (
                      <div key={queue.queue} className="flex items-center justify-between text-sm">
                        <span>{queue.queue}</span>
                        <span className="text-muted-foreground">
                          {queue.depth.waiting ?? 0} waiting · {queue.recentFailureCount} recent
                          failures
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {revenue && revenue.subscriptionsByStatus.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Subscriptions by status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {revenue.subscriptionsByStatus.map((entry) => (
                <Badge key={entry.status} variant="secondary">
                  {entry.status}: {entry.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5" />
        Need to search or impersonate a specific organization?{" "}
        <Link href="/platform/organizations" className="font-medium text-primary hover:underline">
          Go to Organizations
        </Link>
      </div>
    </div>
  );
}
