"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Command } from "cmdk";
import { LogOut, Moon, Search, Sun } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { mainNav, secondaryNav } from "@/config/nav";
import { useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const logout = useLogout();

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-lg overflow-hidden p-0">
        <Command
          className={cn(
            "flex h-full w-full flex-col overflow-hidden rounded-xl bg-transparent",
            "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              autoFocus
              placeholder="Search or jump to..."
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            <Command.Group heading="Navigate">
              {[...mainNav, ...secondaryNav].map((item) => (
                <Command.Item
                  key={item.href}
                  onSelect={() => go(item.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm aria-selected:bg-secondary"
                >
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.label}
                  {item.shortcut && (
                    <span className="ml-auto text-xs text-muted-foreground">{item.shortcut}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Group heading="Actions">
              <Command.Item
                onSelect={() => {
                  setTheme("light");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm aria-selected:bg-secondary"
              >
                <Sun className="h-4 w-4 text-muted-foreground" />
                Switch to light theme
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  setTheme("dark");
                  onOpenChange(false);
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm aria-selected:bg-secondary"
              >
                <Moon className="h-4 w-4 text-muted-foreground" />
                Switch to dark theme
              </Command.Item>
              <Command.Item
                onSelect={() => {
                  onOpenChange(false);
                  logout.mutate();
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-destructive aria-selected:bg-destructive/10"
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
