"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Companies", href: "/crm/companies" },
  { label: "Contacts", href: "/crm/contacts" },
  { label: "Leads", href: "/crm/leads" },
  { label: "Opportunities", href: "/crm/opportunities" },
  { label: "Activities", href: "/crm/activities" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_18%_0%,hsl(217_91%_60%/0.08),transparent_45%),radial-gradient(ellipse_at_78%_8%,hsl(var(--primary)/0.08),transparent_42%)]" />
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(268_83%_68%/0.24)] bg-[hsl(268_83%_68%/0.09)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(268_83%_76%)]"><Sparkles className="h-3.5 w-3.5" />Sales intelligence</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Customer workspace</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Customer context, pipeline movement, and AI-guided follow-through in one operating layer.</p>
        </div>
        <p className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs text-muted-foreground">Live CRM context</p>
      </div>

      <div className="mt-7 overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/20 p-1.5 backdrop-blur-xl">
        <div className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:bg-white/[0.045] hover:text-foreground",
                active && "bg-[linear-gradient(110deg,hsl(var(--primary)/0.14),hsl(268_83%_68%/0.07))] text-foreground shadow-[0_10px_20px_-18px_hsl(var(--primary)/0.9)]",
              )}
            >
              {tab.label}
              {active && <span className="absolute inset-x-4 bottom-1 h-px rounded-full bg-primary/80" />}
            </Link>
          );
        })}
        </div>
      </div>

      <div className="mt-7">{children}</div>
    </div>
  );
}
