"use client";

import Link from "next/link";
import { Bot, Building2, Plug, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCENTS, type Accent } from "@/lib/design-language";
import { cn } from "@/lib/utils";

/**
 * Accents follow the shared colour language rather than being chosen here:
 * AI is purple, organizations blue, automation gold, integrations orange.
 * Previously every tile was identical grey turning gold on hover, so the grid
 * gave no clue what any of these did until you read all four labels.
 */
const ACTIONS: { label: string; href: string; icon: typeof Bot; description: string; accent: Accent }[] = [
  { label: "Start AI chat", href: "/ai", icon: Bot, description: "Ask your AI agent anything", accent: "purple" },
  { label: "Add a company", href: "/crm/companies", icon: Building2, description: "Grow your CRM", accent: "blue" },
  { label: "Build a workflow", href: "/workflows", icon: Workflow, description: "Automate a process", accent: "gold" },
  { label: "Connect an app", href: "/integrations", icon: Plug, description: "Bring in more context", accent: "orange" },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2.5 pt-0 sm:grid-cols-2">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              "group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5",
              "transition-[border-color,background-color,transform] duration-150 ease-out hover:bg-white/[0.04]",
              ACCENTS[action.accent].hoverBorder,
            )}
          >
            {/* The icon well carries the accent at rest, not only on hover —
                colour that appears only on interaction cannot help someone
                scan the grid. */}
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                ACCENTS[action.accent].bg,
                ACCENTS[action.accent].fg,
              )}
            >
              <action.icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{action.label}</p>
              <p className="truncate text-xs text-muted-foreground">{action.description}</p>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
