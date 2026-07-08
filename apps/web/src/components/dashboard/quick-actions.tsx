"use client";

import Link from "next/link";
import { Bot, Building2, Plug, Workflow } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ACTIONS = [
  { label: "Start AI chat", href: "/ai", icon: Bot, description: "Ask your AI agent anything" },
  { label: "Add a company", href: "/crm/companies", icon: Building2, description: "Grow your CRM" },
  { label: "Build a workflow", href: "/workflows", icon: Workflow, description: "Automate a process" },
  { label: "Connect an app", href: "/integrations", icon: Plug, description: "Bring in more context" },
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
            className="group flex items-start gap-3 rounded-xl border border-border p-3.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
              <action.icon className="h-4.5 w-4.5" />
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
