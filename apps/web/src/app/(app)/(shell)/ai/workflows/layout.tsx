"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Workflows", href: "/ai/workflows" },
  { label: "Templates", href: "/ai/workflows/templates" },
];

export default function AiWorkflowsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.href === "/ai/workflows"
              ? pathname === "/ai/workflows"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                active && "text-foreground",
              )}
            >
              {tab.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
