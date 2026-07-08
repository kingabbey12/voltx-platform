"use client";

import { Cloud, Loader2, Mail, MessageSquare, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectedApps } from "@/hooks/use-onboarding";
import { cn } from "@/lib/utils";

interface ConnectApp {
  provider: string;
  label: string;
  icon: LucideIcon;
}

const APPS: ConnectApp[] = [
  { provider: "GOOGLE_GMAIL", label: "Gmail", icon: Mail },
  { provider: "MICROSOFT_OUTLOOK", label: "Outlook", icon: Send },
  { provider: "SLACK", label: "Slack", icon: MessageSquare },
  { provider: "GOOGLE_DRIVE", label: "Google Drive", icon: Cloud },
];

export function ConnectAppsStep({ onNext }: { onNext: () => void }) {
  const { data: connected, isLoading } = useConnectedApps();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Connect your tools</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Voltx agents work best with context from the tools your team already uses.
      </p>

      <div className="mt-8 flex flex-col gap-2.5">
        {APPS.map((app) => {
          const isConnected = connected?.has(app.provider) ?? false;
          return (
            <div
              key={app.provider}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                <app.icon className="h-4.5 w-4.5" />
              </div>
              <span className="flex-1 text-sm font-medium">{app.label}</span>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    isConnected
                      ? "bg-success/15 text-success"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", isConnected ? "bg-success" : "bg-muted-foreground")}
                  />
                  {isConnected ? "Connected" : "Available later"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Google, Microsoft, and Slack connections use a secure web sign-in from Settings →
        Integrations — this won&apos;t block setup.
      </p>

      <Button size="lg" className="mt-6 w-full" onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}
