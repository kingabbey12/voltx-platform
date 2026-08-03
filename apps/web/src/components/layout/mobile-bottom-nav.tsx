"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LayoutDashboard, ListChecks, Plus, Target, UserRoundCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/crm/leads", icon: UserRoundCheck },
  { label: "Create", href: "#quick-create", icon: Plus, create: true },
  { label: "Deals", href: "/crm/opportunities", icon: Target },
  { label: "Tasks", href: "/crm/activities", icon: ListChecks },
  { label: "AI", href: "/ai", icon: Bot },
];

export function MobileBottomNav({ onQuickCreate }: { onQuickCreate: () => void }) {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-black/85 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile navigation"><div className="mx-auto grid max-w-lg grid-cols-6 gap-1">{items.map((item) => {
    const active = item.href !== "#quick-create" && (pathname === item.href || pathname.startsWith(`${item.href}/`));
    const content = <><span className={cn("grid h-9 w-9 place-items-center rounded-xl", item.create ? "-mt-5 border border-primary/45 bg-primary text-primary-foreground shadow-[0_8px_22px_hsl(var(--primary)/0.3)]" : active ? "bg-primary/10 text-primary" : "text-muted-foreground")}><item.icon className="h-4 w-4" /></span><span className={cn("text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>{item.label}</span></>;
    return item.create ? <button key={item.label} type="button" onClick={onQuickCreate} className="flex min-h-[52px] flex-col items-center justify-end gap-0.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring">{content}</button> : <Link key={item.label} href={item.href} className="flex min-h-[52px] flex-col items-center justify-end gap-0.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring">{content}</Link>;
  })}</div></nav>;
}