"use client";

import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { mainNav, secondaryNav } from "@/config/nav";
import { cn } from "@/lib/utils";

function currentPageLabel(pathname: string): string {
  const item = [...mainNav, ...secondaryNav].find(
    (nav) => pathname === nav.href || pathname.startsWith(`${nav.href}/`),
  );
  return item?.label ?? "Voltx";
}

interface TopNavProps {
  scrolled: boolean;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
  onToggleAiPanel: () => void;
}

export function TopNav({
  scrolled,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileNav,
  onOpenCommandPalette,
  onToggleAiPanel,
}: TopNavProps) {
  const pathname = usePathname();

  return (
    <header
      className={cn(
        "flex h-16 shrink-0 items-center gap-3 border-b px-4 transition-all duration-300 ease-out",
        scrolled
          ? "border-border bg-background/80 backdrop-blur-xl"
          : "border-transparent bg-transparent",
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {sidebarCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMobileNav} aria-label="Open menu">
        <Menu className="h-4.5 w-4.5" />
      </Button>

      <h1 className="text-sm font-semibold">{currentPageLabel(pathname)}</h1>

      <button
        onClick={onOpenCommandPalette}
        className="ml-4 hidden max-w-sm flex-1 items-center gap-2 rounded-lg border border-input bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={onToggleAiPanel} aria-label="Toggle AI assistant">
          <Sparkles className="h-4.5 w-4.5" />
        </Button>
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
