"use client";

import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// No backend notifications feed exists yet (no queryable "user
// notifications" API — only a workflow step executor that *sends*
// notifications as an action, not a feed users can read). This is real,
// wired UI with an honest empty state rather than fabricated notification
// items — swap the empty state for a real query once that endpoint exists.
export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4.5 w-4.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
            <Bell className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">You&apos;re all caught up</p>
          <p className="text-xs text-muted-foreground">
            No notifications yet — you&apos;ll see updates here as they happen.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
