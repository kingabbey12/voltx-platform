"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Database, FolderOpen, GitBranch, Search, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Dashboard", href: "/ai/knowledge", icon: BarChart3 },
  { label: "Sources", href: "/ai/knowledge/sources", icon: Database },
  { label: "Documents", href: "/ai/knowledge/documents", icon: FolderOpen },
  { label: "Search", href: "/ai/knowledge/search", icon: Search },
  { label: "Graph", href: "/ai/knowledge/graph", icon: GitBranch },
  { label: "Stats", href: "/ai/knowledge/stats", icon: BookOpen },
];

export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border px-4 py-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/ai/knowledge" && pathname.startsWith(tab.href));
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
