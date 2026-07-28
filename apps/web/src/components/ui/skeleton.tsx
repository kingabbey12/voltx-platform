import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Loading placeholder. Backed by the .skeleton utility in globals.css, whose
 * shimmer stops under prefers-reduced-motion.
 *
 * Skeletons should mirror the shape of the content they stand in for —
 * a spinner tells the user to wait, a skeleton tells them what is coming and
 * keeps the layout from jumping when it arrives.
 *
 * `aria-hidden` because the shape carries no information for a screen reader;
 * announce loading state on the region that owns it (aria-busy) instead.
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} aria-hidden className={cn("skeleton", className)} {...props} />
  ),
);
Skeleton.displayName = "Skeleton";

/** Convenience for the common case: n lines of text, last one short. */
function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 ? "w-2/5" : "w-full")} />
      ))}
    </div>
  );
}

export { Skeleton, SkeletonText };
