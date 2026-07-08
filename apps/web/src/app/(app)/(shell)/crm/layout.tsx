"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Companies", href: "/crm/companies" },
  { label: "Contacts", href: "/crm/contacts" },
  { label: "Leads", href: "/crm/leads" },
  { label: "Opportunities", href: "/crm/opportunities" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">CRM</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Companies, contacts, leads, and opportunities in one connected system.
      </p>

      <div className="mt-6 flex gap-1 border-b border-border">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                active && "text-foreground",
              )}
            >
              {tab.label}
              {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
