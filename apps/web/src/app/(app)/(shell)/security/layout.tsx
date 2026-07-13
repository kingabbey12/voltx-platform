"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Policy", href: "/security" },
  { label: "Sessions", href: "/security/sessions" },
  { label: "Trusted Devices", href: "/security/devices" },
  { label: "MFA", href: "/security/mfa" },
  { label: "API Keys", href: "/security/api-keys" },
  { label: "Login History", href: "/security/login-history" },
];

export default function SecurityLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Security Center</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sessions, trusted devices, multi-factor authentication, API keys, and your organization&apos;s
        security policy.
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => {
          const active =
            tab.href === "/security" ? pathname === tab.href : pathname.startsWith(tab.href);
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
