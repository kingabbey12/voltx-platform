import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

interface Tier {
  name: string;
  description: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  cta: string;
  ctaHref: string;
  featured?: boolean;
  features: string[];
}

const tiers: Tier[] = [
  {
    name: "Starter",
    description: "For small teams getting real work done with AI and automation.",
    monthlyPrice: 29,
    yearlyPrice: 290,
    cta: "Start Free Trial",
    ctaHref: siteConfig.appUrl,
    features: [
      "Up to 5 team members",
      "10 GB storage and 3 active integrations",
      "500 AI requests and 100 workflow executions each month",
      "CRM, communications, calendar, and API access",
    ],
  },
  {
    name: "Professional",
    description: "Full-featured for growing teams that live in Voltx daily.",
    monthlyPrice: 99,
    yearlyPrice: 990,
    cta: "Start Free Trial",
    ctaHref: siteConfig.appUrl,
    featured: true,
    features: [
      "Up to 20 team members",
      "50 GB storage and 10 active integrations",
      "2,500 AI requests and 1,000 workflow executions each month",
      "Higher CRM, communications, and API limits",
    ],
  },
  {
    name: "Business",
    description: "Higher limits and priority support for scaling organizations.",
    monthlyPrice: 299,
    yearlyPrice: 2990,
    cta: "Contact Sales",
    ctaHref: "/contact",
    features: [
      "Up to 100 team members",
      "250 GB storage and 25 active integrations",
      "10,000 AI requests and 10,000 workflow executions each month",
      "Higher communications, API, and CRM capacity",
    ],
  },
  {
    name: "Enterprise",
    description: "For organizations that need scale, control, and dedicated support.",
    cta: "Contact Sales",
    ctaHref: "/contact",
    features: [
      "Unlimited usage across the platform",
      "Custom security and data-retention requirements",
      "Dedicated support and commercial terms",
      "Contact us to scope your rollout",
    ],
  },
];

export function PricingTable() {
  return (
    <div>
      <Reveal>
        <p className="mx-auto max-w-xl text-center text-sm leading-relaxed text-muted-foreground">Every paid plan includes a 14-day trial. Annual rates are shown on each plan; enterprise commercial terms are scoped with your team.</p>
      </Reveal>

      <StaggerGroup className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {tiers.map((tier) => {
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
                  {tier.monthlyPrice === undefined ? (
                    <span className="text-4xl font-semibold tracking-tight">Custom</span>
                  ) : (
                    <span className="text-4xl font-semibold tracking-tight">${tier.monthlyPrice}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{tier.yearlyPrice ? `$${tier.yearlyPrice}/year when billed annually` : "Custom pricing and terms"}</p>

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
