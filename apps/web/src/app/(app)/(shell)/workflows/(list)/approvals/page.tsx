"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { useDecideWorkflowApproval, useWorkflowApprovals } from "@/hooks/use-workflows";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";

export default function WorkflowApprovalsPage() {
  const { data, isLoading } = useWorkflowApprovals();
  const decide = useDecideWorkflowApproval();
  const [comments, setComments] = useState<Record<string, string>>({});

  async function handleDecide(approvalId: string, decision: "APPROVED" | "REJECTED") {
    try {
      await decide.mutateAsync({ approvalId, decision, comment: comments[approvalId] || undefined });
      toast.success(decision === "APPROVED" ? "Approved" : "Rejected");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const pending = data?.items.filter((a) => a.status === "PENDING") ?? [];

  return (
    <div>
      <PageHeader title="Approvals" description="Workflow steps waiting on a decision from you." />

      {isLoading && (
        <div className="mt-6 flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary/60" />
          ))}
        </div>
      )}

      {!isLoading && pending.length === 0 && (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing pending"
          description="Approval requests from running workflows will show up here."
          className="mt-6"
        />
      )}

      <div className="mt-6 flex flex-col gap-3">
        {pending.map((approval) => (
          <Card key={approval.id}>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">Run {approval.workflowRunId.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested {formatRelativeTime(approval.createdAt)}
                    {approval.expiresAt ? ` · expires ${formatRelativeTime(approval.expiresAt)}` : ""}
                  </p>
                </div>
                <Badge variant="warning">PENDING</Badge>
              </div>
              <Textarea
                placeholder="Optional comment"
                value={comments[approval.id] ?? ""}
                onChange={(e) => setComments((c) => ({ ...c, [approval.id]: e.target.value }))}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={decide.isPending}
                  onClick={() => handleDecide(approval.id, "REJECTED")}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button size="sm" isLoading={decide.isPending} onClick={() => handleDecide(approval.id, "APPROVED")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
