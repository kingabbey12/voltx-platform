"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AiCommandCenter } from "@/components/layout/ai-command-center";
import { CommandPalette } from "@/components/layout/command-palette";
import { OrgSwitcher } from "@/components/layout/org-switcher";
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

  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        <div className="hidden md:flex md:flex-col">
          <Sidebar collapsed={sidebarCollapsed} />
          <div className={sidebarCollapsed ? "px-2 pb-3" : "px-3 pb-3"}>
            <OrgSwitcher collapsed={sidebarCollapsed} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopNav
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onToggleAiPanel={() => setAiPanelOpen((v) => !v)}
          />

          <div className="flex min-h-0 flex-1">
            <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
            <AiCommandCenter open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
          </div>
        </div>
      </div>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </TooltipProvider>
  );
}
