"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Clock3, LogOut, Search, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { mainNav, secondaryNav, workspaceNav } from "@/config/nav";
import { useLogout } from "@/hooks/use-auth";
import { useRecentPagesStore } from "@/lib/stores/recent-pages-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAiCopilot: () => void;
}

const navigationItems = [...workspaceNav, ...mainNav, ...secondaryNav].filter(
  (item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index,
);

export function CommandPalette({ open, onOpenChange, onOpenAiCopilot }: CommandPaletteProps) {
  const router = useRouter();
  const logout = useLogout();
  const recentPages = useRecentPagesStore((state) => state.visits);
  const permissions = useAuthStore((state) => state.user?.permissions ?? []);
  const permittedNavigationItems = navigationItems.filter((item) =>
    item.requiredPermissions?.every((permission) => permissions.includes(permission)) ?? true,
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function openAiCopilot() {
    onOpenChange(false);
    onOpenAiCopilot();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-2xl overflow-hidden rounded-[24px] border-white/[0.10] bg-[linear-gradient(145deg,hsl(268_83%_68%/0.08),transparent_40%),hsl(0_0%_5%/0.98)] p-0 shadow-[0_30px_100px_-40px_black]">
        {/* Radix requires an accessible name on every dialog; without one
            screen readers announce it as an unlabelled dialog (Axe
            `aria-dialog-name`). Visually hidden — the input already carries
            the visible affordance. */}
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command
          className={cn(
            "flex h-full w-full flex-col overflow-hidden rounded-[24px] bg-transparent",
            "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-4">
            <span className="grid h-8 w-8 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Search className="h-4 w-4" /></span>
            <Command.Input
              autoFocus
              placeholder="Search your operating system..."
              className="flex h-14 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded-md border border-white/[0.09] bg-black/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
          </div>
          <Command.List className="max-h-[460px] overflow-y-auto p-2">
            <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
              No matching route or command.
            </Command.Empty>
            <Command.Group heading="AI Copilot">
              <Command.Item onSelect={openAiCopilot} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[hsl(268_83%_68%/0.20)] bg-[hsl(268_83%_68%/0.08)] px-3 py-3 text-sm aria-selected:bg-[hsl(268_83%_68%/0.16)]">
                <span className="grid h-8 w-8 place-items-center rounded-xl border border-[hsl(268_83%_68%/0.28)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]"><Sparkles className="h-4 w-4" /></span><span className="flex-1"><span className="block font-medium">Ask AI Copilot</span><span className="mt-0.5 block text-[11px] text-muted-foreground">Analyze the current workspace with real context</span></span><span className="text-[11px] text-[hsl(268_83%_76%)]">AI</span>
              </Command.Item>
            </Command.Group>
            {recentPages.length > 0 && <Command.Group heading="Recent items">
              {recentPages.slice(0, 5).map((page) => (
                <Command.Item key={page.path} value={`Recent ${page.label}`} onSelect={() => go(page.path)} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-white/[0.055]">
                  <Clock3 className="h-4 w-4 text-muted-foreground" /><span className="flex-1">{page.label}</span><span className="text-[11px] text-muted-foreground">Recent</span>
                </Command.Item>
              ))}
            </Command.Group>}
            <Command.Group heading="Navigate">
              {permittedNavigationItems.map((item) => (
                <Command.Item
                  key={item.href}
                  onSelect={() => go(item.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-white/[0.055]"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                  {item.shortcut && (
                    <span className="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Account">
              <Command.Item
                onSelect={() => {
                  onOpenChange(false);
                  logout.mutate();
                }}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive aria-selected:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
