"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * A label that starts centered inside the field and floats above it once
 * the field has focus or a value — the Forms spec's "floating labels"
 * requirement, kept as its own component so the base `Input` primitive
 * (used everywhere else) stays untouched.
 */
const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ className, id, label, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="relative">
        <input
          id={inputId}
          ref={ref}
          {...props}
          placeholder=" "
          className={cn(
            "peer flex h-14 w-full rounded-lg border border-input bg-background px-3 pt-4 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        />
        <label
          htmlFor={inputId}
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground transition-all duration-200 ease-out",
            "peer-focus:top-4 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary",
            "peer-[:not(:placeholder-shown)]:top-4 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs",
          )}
        >
          {label}
        </label>
      </div>
    );
  },
);
FloatingLabelInput.displayName = "FloatingLabelInput";

export { FloatingLabelInput };
