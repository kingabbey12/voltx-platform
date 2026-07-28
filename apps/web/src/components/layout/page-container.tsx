import { cn } from "@/lib/utils";

/**
 * The layout frame every authenticated page sits in.
 *
 * Pages were each hand-rolling their own container — `max-w-5xl px-6 py-8`,
 * `max-w-6xl px-6 py-8`, or a bare `flex flex-col gap-6` with no width bound at
 * all. The result was that navigating between pages shifted the content column
 * sideways, which reads as sloppiness even when every individual page looks
 * fine. Width, gutters and vertical rhythm belong in one place.
 *
 * Sizes are intent-named rather than numeric so call sites say what kind of
 * page they are, not how many pixels they want:
 *
 *   narrow   forms, settings, anything read top-to-bottom
 *   default  most pages — lists, detail views
 *   wide     dashboards and tables that genuinely need the horizontal room
 *   full     canvases that manage their own bounds (workflow builder, chat)
 */
const SIZES = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-[1400px]",
  full: "max-w-none",
} as const;

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof SIZES;
  children: React.ReactNode;
}

export function PageContainer({
  size = "default",
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        // Gutters step up with the viewport so content never sits against the
        // edge on mobile, and never floats in a too-wide column on desktop.
        "mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8",
        // The gap is the page's vertical rhythm: header, then sections, all
        // spaced identically everywhere.
        "flex flex-col gap-6 md:gap-8",
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * A titled block within a page. Optional — use it when a page has more than one
 * distinct region, so section headings share one type scale instead of each
 * page inventing an h2.
 */
export function PageSection({
  title,
  description,
  action,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-4", className)} {...props}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
