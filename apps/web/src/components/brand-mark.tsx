import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]",
        className,
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}
