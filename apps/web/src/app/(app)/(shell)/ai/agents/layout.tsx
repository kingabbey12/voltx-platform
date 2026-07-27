"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Plus, BarChart3, History } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Agents", href: "/ai/agents", icon: Bot },
  { label: "New Agent", href: "/ai/agents/new", icon: Plus },
  { label: "Analytics", href: "/ai/agents/analytics", icon: BarChart3 },
  { label: "Activity", href: "/ai/agents/activity", icon: History },
];

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/ai/agents") return pathname === "/ai/agents";
    if (href === "/ai/agents/new") return pathname === "/ai/agents/new";
    if (href === "/ai/agents/analytics") return pathname.startsWith("/ai/agents/analytics");
    if (href === "/ai/agents/activity") return pathname.startsWith("/ai/agents/activity");
    return false;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
