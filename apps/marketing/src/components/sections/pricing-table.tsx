"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

interface Tier {
  name: string;
  description: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  priceSuffix: string;
  cta: string;
  ctaHref: string;
  featured?: boolean;
  features: string[];
}

const tiers: Tier[] = [
  {
    name: "Starter",
    description: "For individuals and small teams getting started with AI-powered work.",
    monthlyPrice: 0,
    annualPrice: 0,
    priceSuffix: "forever",
    cta: "Start Free",
    ctaHref: siteConfig.appUrl,
    features: [
      "Up to 10 seats",
      "Core CRM (companies, contacts, deals)",
      "1 AI agent",
      "Community support",
    ],
  },
  {
    name: "Growth",
    description: "For growing teams that need the full AI workspace and automation.",
    monthlyPrice: 49,
    annualPrice: 39,
    priceSuffix: "per seat / month",
    cta: "Start Free Trial",
    ctaHref: siteConfig.appUrl,
    featured: true,
    features: [
      "Up to 50 seats",
      "Full AI workspace: multi-agent workflows & knowledge search",
      "Unlimited workflows and integrations",
      "Dedicated customer success manager",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    description: "For organizations that need scale, control, and dedicated support.",
    monthlyPrice: null,
    annualPrice: null,
    priceSuffix: "custom pricing",
    cta: "Book Demo",
    ctaHref: "/contact",
    features: [
      "Unlimited seats",
      "SSO / SCIM provisioning",
      "Custom data retention & security review",
      "Dedicated Solutions Engineer",
      "Named support SLA & 99.9% uptime commitment",
    ],
  },
];

export function PricingTable() {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      <Reveal>
        <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-border bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
            aria-pressed={!annual}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              annual ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
            aria-pressed={annual}
          >
            Annual
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                annual ? "bg-white/20" : "bg-primary/10 text-primary",
              )}
            >
              Save 20%
            </span>
          </button>
        </div>
      </Reveal>

      <StaggerGroup className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {tiers.map((tier) => {
          const price = annual ? tier.annualPrice : tier.monthlyPrice;
          return (
            <StaggerItem key={tier.name}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border p-8",
                  tier.featured
                    ? "shimmer-border border-primary/30 bg-card shadow-[0_20px_80px_-30px_hsl(var(--primary)/0.5)]"
                    : "border-border bg-card",
                )}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold text-white">
                    <Sparkles className="h-3 w-3" />
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {tier.description}
                </p>

                <div className="mt-6 flex items-baseline gap-2">
                  {price === null ? (
                    <span className="text-4xl font-semibold tracking-tight">Custom</span>
                  ) : (
                    <span className="text-4xl font-semibold tracking-tight">${price}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tier.priceSuffix}</p>

                <Button
                  size="lg"
                  variant={tier.featured ? "primary" : "secondary"}
                  className="mt-7 w-full"
                  asChild
                >
                  <a href={tier.ctaHref}>{tier.cta}</a>
                </Button>

                <ul className="mt-8 flex flex-1 flex-col gap-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground/90">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </div>
  );
}
