"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { agentsApi, type AgentApproval } from "@/lib/api/agents";
import { describeApproval } from "@/lib/today/describe-approval";

/**
 * Held work for the Today screen: pending agent approvals read as a ledger of
 * prepared sentences. Per the spec: rows never lock each other, a failed verb
 * returns to an actionable state immediately, and a signed row stays on the
 * page as a record ("Sent") rather than vanishing — the ledger is this
 * morning's enclosure list, so it is snapshotted on arrival and refreshed on
 * the next visit, not live-mutated underneath the reader.
 */

export type HeldWorkStatus = "held" | "sending" | "sent" | "failed";

export interface HeldWorkItem {
  approval: AgentApproval;
  sentence: string;
  verb: string;
  status: HeldWorkStatus;
}

export function useHeldWork() {
  const queryClient = useQueryClient();
  const [statusById, setStatusById] = useState<Record<string, HeldWorkStatus>>({});
  const [ledger, setLedger] = useState<AgentApproval[] | null>(null);

  const query = useQuery({
    queryKey: ["today", "held-work"],
    queryFn: () => agentsApi.listPendingApprovals({ page: 1, limit: 20 }),
    // Each arrival at Today reads the ledger fresh.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (ledger === null && query.data) {
      setLedger(query.data.items);
    }
  }, [ledger, query.data]);

  const setStatus = useCallback((id: string, status: HeldWorkStatus) => {
    setStatusById((current) => ({ ...current, [id]: status }));
  }, []);

  const sign = useCallback(
    async (approvalId: string) => {
      setStatus(approvalId, "sending");
      try {
        await agentsApi.decideApproval(approvalId, "APPROVED");
        setStatus(approvalId, "sent");
        // Let other surfaces (the operator page) agree in the background;
        // this screen keeps rendering its snapshot until the next arrival.
        void queryClient.invalidateQueries({ queryKey: ["today", "held-work"] });
      } catch {
        setStatus(approvalId, "failed");
      }
    },
    [queryClient, setStatus],
  );

  const items: HeldWorkItem[] = (ledger ?? []).map((approval) => ({
    approval,
    ...describeApproval(approval),
    status: statusById[approval.id] ?? "held",
  }));

  return {
    items,
    loading: query.isLoading && ledger === null,
    error: query.isError && ledger === null,
    sign,
    retry: (approvalId: string) => {
      void sign(approvalId);
    },
  };
}
