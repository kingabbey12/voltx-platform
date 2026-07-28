import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * The single card surface for the whole product — 83 files consume this, so
 * depth and elevation are defined here once rather than re-implemented per
 * page.
 *
 * `variant` exists because the previous implementation lifted *every* card on
 * hover, including purely static ones. Motion that doesn't correspond to an
 * affordance reads as noise, and it was a large part of why the app felt like
 * an undifferentiated stack of boxes. Hover lift now belongs to `interactive`,
 * which is what a card you can actually click should use.
 *
 * Depth comes from the .surface primitives in globals.css: a near-black base,
 * a faint top-down gradient implying a light source above, and a hairline
 * border brighter at the top edge.
 */
const cardVariants = cva("text-card-foreground", {
  variants: {
    variant: {
      /** Static content. The default — no hover affordance. */
      default: "surface",
      /** Clickable or navigable cards: 1px lift, border warms toward gold. */
      interactive: "surface-interactive cursor-pointer",
      /** Sits above other surfaces — modals, popovers, hero cards. */
      raised: "surface-raised",
      /** Translucent, for layering over imagery or ambient glow. */
      glass: "glass-panel rounded-[var(--radius)] backdrop-blur-xl",
    },
  },
  defaultVariants: { variant: "default" },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-heading text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
