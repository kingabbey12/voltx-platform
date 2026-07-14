"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Consent Records", href: "/compliance" },
  { label: "GDPR Requests", href: "/compliance/gdpr" },
  { label: "Legal Holds", href: "/compliance/legal-holds" },
  { label: "Audit Log", href: "/compliance/audit" },
  { label: "Retention Policies", href: "/compliance/retention" },
];

export default function ComplianceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Compliance Center</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Consent history, GDPR data subject requests, legal holds, tamper-evident audit exports, and
        data retention policies for this organization.
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.href === "/compliance" ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative whitespace-nowrap px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
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
