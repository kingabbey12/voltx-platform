"use client";

import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEndImpersonation } from "@/hooks/use-platform";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { useImpersonationStore } from "@/lib/stores/impersonation-store";

/**
 * Site-wide banner shown for the duration of an active support session
 * (v2.2 Customer Success) — rendered in the root (app) layout so it
 * persists across every page, not just the platform console, since
 * impersonation lets a platform admin browse the target org's own
 * dashboard/inbox/CRM as if logged in there. Exiting is always one click
 * away, per the plan's "hard UX requirement, not optional."
 */
export function ImpersonationBanner() {
  const info = useImpersonationStore((state) => state.info);
  const endImpersonation = useEndImpersonation();

  if (!info) {
    return null;
  }

  async function handleExit() {
    if (!info) return;
    try {
      await endImpersonation.mutateAsync(info.sessionId);
      toast.success("Exited impersonation");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Impersonating <span className="font-medium">{info.organizationName}</span> as a platform
          admin — every action is audited under this support session.
        </span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-warning/40 bg-transparent hover:bg-warning/10"
        onClick={() => void handleExit()}
        isLoading={endImpersonation.isPending}
      >
        Exit impersonation
      </Button>
    </div>
  );
}
