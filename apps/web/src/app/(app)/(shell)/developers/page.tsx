"use client";

import Link from "next/link";
import {
  BookOpen,
  Key,
  ListTree,
  ScrollText,
  ShieldCheck,
  Terminal,
  Webhook,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useOAuthApplications,
  usePersonalAccessTokens,
  useServiceAccounts,
  useWebhookEndpoints,
} from "@/hooks/use-developer-portal";

const SECTIONS = [
  {
    href: "/developers/personal-access-tokens",
    icon: Key,
    title: "Personal Access Tokens",
    description: "Bearer tokens for your own scripts, scoped to a subset of your permissions.",
    countKey: "pats" as const,
  },
  {
    href: "/developers/service-accounts",
    icon: ShieldCheck,
    title: "Service Accounts",
    description: "Machine identities for CI/CD and background integrations.",
    countKey: "serviceAccounts" as const,
  },
  {
    href: "/developers/oauth-applications",
    icon: ListTree,
    title: "OAuth Applications",
    description: "Let a third-party app act on a user's behalf via OAuth 2.0.",
    countKey: "oauthApps" as const,
  },
  {
    href: "/developers/webhooks",
    icon: Webhook,
    title: "Webhooks",
    description: "Get notified in real time when events happen in your organization.",
    countKey: "webhooks" as const,
  },
  {
    href: "/developers/api-docs",
    icon: BookOpen,
    title: "API Reference",
    description: "Browse every endpoint straight from the live OpenAPI 3.1 document.",
    countKey: null,
  },
  {
    href: "/developers/playground",
    icon: Terminal,
    title: "Playground",
    description: "Fire real authenticated requests against the API from your browser.",
    countKey: null,
  },
  {
    href: "/developers/changelog",
    icon: ScrollText,
    title: "Changelog",
    description: "What's new in the Voltx public API, release by release.",
    countKey: null,
  },
];

export default function DevelopersOverviewPage() {
  const pats = usePersonalAccessTokens();
  const serviceAccounts = useServiceAccounts();
  const oauthApps = useOAuthApplications();
  const webhooks = useWebhookEndpoints();

  const counts: Record<string, number | undefined> = {
    pats: pats.data?.length,
    serviceAccounts: serviceAccounts.data?.length,
    oauthApps: oauthApps.data?.length,
    webhooks: webhooks.data?.length,
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const count = section.countKey ? counts[section.countKey] : undefined;
        return (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  {count !== undefined && (
                    <span className="text-sm font-medium text-muted-foreground">{count}</span>
                  )}
                </div>
                <CardTitle className="mt-2">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
