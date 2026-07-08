"use client";

import { useTheme } from "next-themes";
import { LogOut, Moon, Settings, Sun, SunMoon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useLogout } from "@/hooks/use-auth";
import Link from "next/link";

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.firstName} />
            <AvatarFallback>{initials(user.firstName, user.lastName)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <SunMoon className="h-4 w-4" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="h-4 w-4" />
              Light
              {theme === "light" && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="h-4 w-4" />
              Dark
              {theme === "dark" && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <SunMoon className="h-4 w-4" />
              System
              {theme === "system" && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout.mutate()} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
