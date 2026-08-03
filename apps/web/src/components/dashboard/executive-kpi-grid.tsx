"use client";

import { Building2, CircleDollarSign, MessageCircleMore, UserRoundCheck } from "lucide-react";
import { ExecutiveKpiCard, type ExecutiveKpiState } from "@/components/dashboard/executive-kpi-card";
import { useConversations } from "@/hooks/use-ai";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import type { ExecutiveSnapshot } from "@/lib/api/dashboard";
import { formatCount, formatCurrency } from "@/lib/format";

function series(snapshot: ExecutiveSnapshot | undefined, key: string): number[] | undefined {
  const points = snapshot?.trends[key];
  return points && points.length > 2 ? points.map((point) => point.value) : undefined;
}

function change(snapshot: ExecutiveSnapshot | undefined, key: string) {
  const value = snapshot?.changes[key];
  return value && value.percent !== null ? { percent: value.percent, comparedTo: value.comparedTo } : undefined;
}

export function ExecutiveKpiGrid() {
  const { data, isLoading, isError } = useDashboardMetrics();
  const { data: conversations, isLoading: conversationsLoading, isError: conversationsError } = useConversations({ limit: 1 });
  const state = (value: number | undefined): ExecutiveKpiState => isLoading ? "loading" : isError ? "error" : value ? "ready" : "empty";
  const conversationState: ExecutiveKpiState = conversationsLoading ? "loading" : conversationsError ? "error" : conversations?.total ? "ready" : "empty";
  const count = (value: number) => formatCount(Math.round(value));

  return (
    <section aria-label="Executive performance" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ExecutiveKpiCard label="Pipeline value" icon={CircleDollarSign} accent="gold" state={state(data?.snapshot.pipelineValue)} value={data?.snapshot.pipelineValue} format={formatCurrency} trend={series(data, "pipelineValue")} change={change(data, "pipelineValue")} href="/crm/opportunities" emptyLabel="Create your first opportunity" emptyDescription="Pipeline value appears when a live deal enters your CRM." />
      <ExecutiveKpiCard label="Companies" icon={Building2} accent="blue" state={state(data?.snapshot.companies)} value={data?.snapshot.companies} format={count} trend={series(data, "companies")} change={change(data, "companies")} href="/crm/companies" emptyLabel="Add your first company" emptyDescription="Build the accounts your team is growing with." />
      <ExecutiveKpiCard label="Qualified leads" icon={UserRoundCheck} accent="orange" state={state(data?.snapshot.qualifiedLeads)} value={data?.snapshot.qualifiedLeads} format={count} trend={series(data, "qualifiedLeads")} change={change(data, "qualifiedLeads")} href="/crm/leads" emptyLabel="Start qualifying leads" emptyDescription="Qualified leads appear once prospects are ready for attention." />
      <ExecutiveKpiCard label="AI conversations" icon={MessageCircleMore} accent="purple" state={conversationState} value={conversations?.total} format={count} href="/ai" emptyLabel="Start an AI conversation" emptyDescription="Voltx conversations appear here as your team puts AI to work." />
    </section>
  );
}