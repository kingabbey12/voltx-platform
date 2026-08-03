"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AiCommandCenter } from "@/components/layout/ai-command-center";
import { CommandPalette } from "@/components/layout/command-palette";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTrackPageVisit } from "@/lib/ai/context-engine";
import { useCommsRealtime } from "@/hooks/use-comms-realtime";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  useTrackPageVisit();
  useCommsRealtime();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        {/* This wrapper owns the full height so the nav can scroll inside it
            while the workspace switcher stays pinned to the bottom. Previously
            the Sidebar itself claimed h-svh and the switcher sat below it,
            which pushed the switcher past the fold and clipped the nav. */}
        <div className="hidden h-svh md:flex md:flex-col">
          <Sidebar collapsed={sidebarCollapsed} onQuickCreate={() => setCommandOpen(true)} />
          <div
            className={cn(
              "shrink-0 border-t border-sidebar-border bg-sidebar pb-3 pt-3",
              sidebarCollapsed ? "px-2" : "px-3",
            )}
          >
            <OrgSwitcher collapsed={sidebarCollapsed} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav
            scrolled={scrolled}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onToggleAiPanel={() => setAiPanelOpen((v) => !v)}
          />

          <div className="flex min-h-0 flex-1">
            <main
              className="min-w-0 flex-1 overflow-y-auto"
              onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
            >
              <div className="min-h-full">{children}</div>
            </main>
            <AiCommandCenter open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
          </div>
        </div>
      </div>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <MobileBottomNav onQuickCreate={() => setCommandOpen(true)} />
      <CommandPalette
        open={commandOpen}
        onOpenChange={setCommandOpen}
        onOpenAiCopilot={() => setAiPanelOpen(true)}
      />
    </TooltipProvider>
  );
}
