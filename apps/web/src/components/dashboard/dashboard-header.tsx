"use client";

import { CalendarDays, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyOrganizations } from "@/hooks/use-organizations";
import { useAuthStore } from "@/lib/stores/auth-store";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader() {
  const user = useAuthStore((state) => state.user);
  const { data: organizations } = useMyOrganizations();
  const workspace = organizations?.find((organization) => organization.organizationId === user?.organizationId);
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{date}</span>
          {workspace && <><span className="h-1 w-1 rounded-full bg-border" /><span>{workspace.organizationName}</span></>}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {greeting()}{user?.firstName ? `, ${user.firstName}` : ""} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Here is what is happening across your business today.
        </p>
      </div>
      <Button asChild variant="ghost" className="w-fit text-primary hover:text-primary">
        <a href="#chief-of-staff"><Sparkles className="h-4 w-4" />Review executive context<ChevronRight className="h-4 w-4" /></a>
      </Button>
    </header>
  );
}