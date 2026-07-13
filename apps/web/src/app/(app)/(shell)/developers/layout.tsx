"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/developers" },
  { label: "Personal Access Tokens", href: "/developers/personal-access-tokens" },
  { label: "Service Accounts", href: "/developers/service-accounts" },
  { label: "OAuth Applications", href: "/developers/oauth-applications" },
  { label: "Webhooks", href: "/developers/webhooks" },
  { label: "API Reference", href: "/developers/api-docs" },
  { label: "Playground", href: "/developers/playground" },
  { label: "Changelog", href: "/developers/changelog" },
];

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Developer Platform</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Build on Voltx: manage credentials, register OAuth apps, subscribe to webhooks, and explore the
        API.
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.href === "/developers" ? pathname === tab.href : pathname.startsWith(tab.href);
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
