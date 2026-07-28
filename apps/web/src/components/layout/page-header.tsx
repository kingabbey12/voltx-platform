import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderMetric {
  label: string;
  value: string;
  /** Signed change, already formatted — e.g. "+12.5%". */
  delta?: string;
  /** Colours the delta. `flat` stays neutral rather than implying a verdict. */
  trend?: "up" | "down" | "flat";
}

export interface PageHeaderCrumb {
  label: string;
  /** Omit on the current page — the last crumb should not be a link. */
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** Primary call to action. Kept as `action` so the 16 existing call sites
   *  continue to work unchanged. */
  action?: React.ReactNode;
  className?: string;

  /** Small label above the title — section or record type. */
  eyebrow?: string;
  breadcrumbs?: PageHeaderCrumb[];
  /** Status chip rendered inline with the title, e.g. <Badge>Active</Badge>. */
  status?: React.ReactNode;
  /** Lower-emphasis actions, placed before the primary CTA. */
  secondaryActions?: React.ReactNode;
  /** Contextual AI entry points for this page — summarise, detect risk,
   *  recommend next actions. Rendered in its own row so AI reads as a
   *  first-class affordance rather than one more button in a toolbar. */
  aiActions?: React.ReactNode;
  /** Optional at-a-glance numbers. Keep to four or fewer; beyond that it
   *  stops being a summary and becomes a table. */
  metrics?: PageHeaderMetric[];
}

/**
 * The single page header for the product.
 *
 * Every authenticated page gets its hierarchy from here rather than composing
 * its own title block, so vertical rhythm, type scale and action placement stay
 * identical across all 104 pages. Everything beyond `title` is optional, which
 * is what lets pages adopt the richer parts incrementally.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
  eyebrow,
  breadcrumbs,
  status,
  secondaryActions,
  aiActions,
  metrics,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" aria-hidden />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground/70">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary/70">
              {eyebrow}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              {title}
            </h1>
            {status}
          </div>
          {description && (
            <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {(secondaryActions || action) && (
          // On mobile the actions wrap under the title rather than competing
          // with it for a narrow row.
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {secondaryActions}
            {action}
          </div>
        )}
      </div>

      {aiActions && <div className="flex flex-wrap items-center gap-2">{aiActions}</div>}

      {metrics && metrics.length > 0 && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-card px-4 py-3">
              <dt className="truncate text-xs text-muted-foreground">{metric.label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg font-semibold tabular-nums tracking-tight">
                  {metric.value}
                </span>
                {metric.delta && (
                  <span
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      metric.trend === "up" && "text-success",
                      metric.trend === "down" && "text-destructive",
                      (!metric.trend || metric.trend === "flat") && "text-muted-foreground",
                    )}
                  >
                    {metric.delta}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}
