import { cn } from "@/lib/utils";
import type { AlertSeverity, AlertStatus } from "@/lib/api/ai-monitoring";

export const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { className: string; label: string }
> = {
  CRITICAL: {
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
    label: "Critical",
  },
  HIGH: {
    className: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    label: "High",
  },
  MEDIUM: {
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    label: "Medium",
  },
  LOW: {
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    label: "Low",
  },
  INFO: {
    className: "bg-secondary text-secondary-foreground",
    label: "Info",
  },
};

export const STATUS_CONFIG: Record<
  AlertStatus,
  { className: string; label: string }
> = {
  OPEN: {
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
    label: "Open",
  },
  ACKNOWLEDGED: {
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    label: "Acknowledged",
  },
  RESOLVED: {
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    label: "Resolved",
  },
  DISMISSED: {
    className: "bg-muted text-muted-foreground",
    label: "Dismissed",
  },
};

export function AlertSeverityBadge({
  severity,
}: {
  severity: AlertSeverity;
}) {
  const c = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}
