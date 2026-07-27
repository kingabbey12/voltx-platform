"use client";

import Link from "next/link";
import { Database, MessageSquare, GitBranch, Plus, Play, Search, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACTIONS = [
  { label: "New Agent", href: "/ai/agents/new", icon: Plus, color: "bg-primary/10 text-primary" },
  { label: "Run Agent", href: "/ai/agents", icon: Play, color: "bg-emerald-500/10 text-emerald-600" },
  { label: "New Conversation", href: "/ai", icon: MessageSquare, color: "bg-blue-500/10 text-blue-600" },
  { label: "Search Knowledge", href: "/ai/knowledge/search", icon: Search, color: "bg-violet-500/10 text-violet-600" },
  { label: "Add Source", href: "/ai/knowledge/sources", icon: Database, color: "bg-amber-500/10 text-amber-600" },
  { label: "Create Workflow", href: "/workflows/new", icon: GitBranch, color: "bg-rose-500/10 text-rose-600" },
];

export function QuickActionsWidget() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <Link key={action.href} href={action.href}>
              <Button
                variant="outline"
                className="h-auto w-full justify-start gap-2 px-3 py-2.5 text-xs font-medium"
              >
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${action.color}`}>
                  <action.icon className="h-3.5 w-3.5" />
                </div>
                {action.label}
              </Button>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
