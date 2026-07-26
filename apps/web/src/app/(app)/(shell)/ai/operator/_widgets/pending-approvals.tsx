"use client";

import { ListChecks, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAiTasks, useDecideApproval } from "@/hooks/use-ai-dashboard";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export function PendingApprovalsWidget() {
  const { data, isLoading } = useAiTasks();
  const decideApproval = useDecideApproval();

  const pending = data?.pendingApprovals ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4" />
          Pending Approvals
        </CardTitle>
        {!isLoading && pending.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
            {pending.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && pending.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            <p className="text-xs text-muted-foreground">All caught up</p>
          </div>
        )}
        {pending.length > 0 && (
          <div className="space-y-2">
            {pending.map((approval) => (
              <div key={approval.id} className="rounded-lg border border-border p-2.5 text-xs">
                <p className="font-medium">{approval.toolName.replace(/_/g, " ")}</p>
                {approval.summary && (
                  <p className="mt-0.5 text-muted-foreground">{approval.summary}</p>
                )}
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    disabled={decideApproval.isPending}
                    onClick={() =>
                      decideApproval.mutate(
                        { approvalId: approval.id, decision: "REJECTED" },
                        { onSuccess: () => toast.success("Rejected"), onError: (e) => toast.error(friendlyErrorMessage(e)) },
                      )
                    }
                  >
                    <XCircle className="h-3 w-3" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={decideApproval.isPending}
                    onClick={() =>
                      decideApproval.mutate(
                        { approvalId: approval.id, decision: "APPROVED" },
                        { onSuccess: () => toast.success("Approved"), onError: (e) => toast.error(friendlyErrorMessage(e)) },
                      )
                    }
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
