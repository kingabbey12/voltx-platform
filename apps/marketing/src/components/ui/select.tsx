import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Native <select> styled to match Input. Deliberately not a Radix listbox:
 * these are short, well-known option sets on lead-capture forms, where the
 * platform control gives free mobile ergonomics, keyboard behaviour and
 * screen-reader semantics — and avoids adding a dependency for one use.
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "flex h-11 w-full appearance-none rounded-lg border border-input bg-background/60 px-4 py-2 pr-10 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          // A required select whose placeholder is still selected renders in
          // muted text, so it reads as a placeholder rather than an answer.
          "invalid:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
});
Select.displayName = "Select";

export { Select };
