"use client";

import { Bot, Building2, TrendingUp, Users } from "lucide-react";
import { KpiCard, type KpiCardProps } from "@/components/dashboard/kpi-card";
import { useCompanies, useLeads, useOpportunities } from "@/hooks/use-sales";
import { useConversations } from "@/hooks/use-ai";
import { formatCount, formatCurrency } from "@/lib/format";

/**
 * The dashboard KPI row.
 *
 * Each metric comes from a list endpoint's pagination `total` — the API has no
 * dashboard/metrics endpoint and no historical series anywhere, so no card here
 * passes `series` or `delta`. KpiCard renders honestly without them rather than
 * inventing a trend line.
 *
 * The empty case is the one that matters most: a brand-new workspace has zero
 * of everything, and four zeros tell a new user nothing except that the product
 * looks broken. Each card instead explains what the metric is, why it matters,
 * and links to the action that produces it.
 */
export function KpiCards() {
  // limit: 100 is a real ceiling, not a page size — the pipeline total is summed
  // client-side, so a workspace with more than 100 open opportunities silently
  // undercounts. The correct fix is a server-side aggregate; flagged in the
  // handover rather than papered over by raising the limit.
  const {
    data: opportunities,
    isLoading: loadingOpps,
    isError: errorOpps,
  } = useOpportunities({ limit: 100 });
  const {
    data: companies,
    isLoading: loadingCompanies,
    isError: errorCompanies,
  } = useCompanies({ limit: 1 });
  const {
    data: leads,
    isLoading: loadingLeads,
    isError: errorLeads,
  } = useLeads({ limit: 1, status: "QUALIFIED" });
  const {
    data: conversations,
    isLoading: loadingConversations,
    isError: errorConversations,
  } = useConversations({ limit: 1 });

  const pipelineValue =
    opportunities?.items
      .filter((o) => o.stage !== "CLOSED_LOST" && o.stage !== "CLOSED_WON")
      .reduce((sum, o) => sum + (o.amount ?? 0), 0) ?? 0;

  const formatWholeCount = (current: number) => formatCount(Math.round(current));

  /** Zero is treated as "nothing here yet" rather than a value worth showing. */
  function resolve(
    isLoading: boolean,
    isError: boolean,
    value: number | undefined,
  ): { state: KpiCardProps["state"]; value: number } {
    if (isLoading) return { state: "loading", value: 0 };
    if (isError) return { state: "error", value: 0 };
    if (!value) return { state: "empty", value: 0 };
    return { state: "ready", value };
  }

  const pipeline = resolve(loadingOpps, errorOpps, pipelineValue || undefined);
  const companyCount = resolve(loadingCompanies, errorCompanies, companies?.total);
  const leadCount = resolve(loadingLeads, errorLeads, leads?.total);
  const conversationCount = resolve(loadingConversations, errorConversations, conversations?.total);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Pipeline value"
        icon={TrendingUp}
        state={pipeline.state}
        value={pipeline.value}
        format={formatCurrency}
        action={{ label: "View pipeline", href: "/crm/opportunities" }}
        guidance={{
          explanation:
            "The total value of deals you could still win — the clearest signal of future revenue.",
          action: { label: "Create an opportunity", href: "/crm/opportunities" },
        }}
      />

      <KpiCard
        label="Companies"
        icon={Building2}
        state={companyCount.state}
        value={companyCount.value}
        format={formatWholeCount}
        action={{ label: "View companies", href: "/crm/companies" }}
        guidance={{
          explanation:
            "The organisations you sell to. Contacts, deals and activity all hang off these.",
          action: { label: "Add your first company", href: "/crm/companies" },
        }}
      />

      <KpiCard
        label="Qualified leads"
        icon={Users}
        state={leadCount.state}
        value={leadCount.value}
        format={formatWholeCount}
        action={{ label: "View leads", href: "/crm/leads" }}
        guidance={{
          explanation:
            "Leads worth your team's time, separated from the ones that are not. Qualify early to protect focus.",
          action: { label: "Add your first lead", href: "/crm/leads" },
        }}
      />

      <KpiCard
        label="AI conversations"
        icon={Bot}
        state={conversationCount.state}
        value={conversationCount.value}
        format={formatWholeCount}
        action={{ label: "Open AI chat", href: "/ai" }}
        guidance={{
          explanation:
            "Work handed to an AI agent — drafting, research, follow-up — instead of done by hand.",
          action: { label: "Start your first chat", href: "/ai" },
        }}
      />
    </div>
  );
}
