import type { Metadata } from "next";
import {
  ClipboardCheck,
  FileClock,
  KeyRound,
  Lock,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { FeatureDetailBlock, type FeatureDetail } from "@/components/sections/feature-detail";
import { CtaSection } from "@/components/sections/cta-section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Enterprise",
  description:
    "SSO and SCIM provisioning, database-level tenant isolation, a full audit trail, and a dedicated Compliance Center — the controls enterprise security reviews ask for.",
};

interface Capability {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
}

const capabilities: Capability[] = [
  {
    icon: UserCog,
    title: "SSO & SCIM provisioning",
    description:
      "Centralize identity management with SAML/OIDC single sign-on and SCIM-driven user and group provisioning — onboard and offboard automatically.",
  },
  {
    icon: Lock,
    title: "Database-level tenant isolation",
    description:
      "Every organization's data is scoped at the ORM layer, not just filtered in application code — a Prisma Client Extension enforces it on every query.",
  },
  {
    icon: ScrollText,
    title: "Full audit trail",
    description:
      "Every action across every organization is logged and independently verifiable, with export support for your own compliance tooling.",
  },
  {
    icon: FileClock,
    title: "Retention & legal holds",
    description:
      "Configure data retention policies per organization, and place legal holds on records that must survive normal retention rules.",
  },
  {
    icon: ClipboardCheck,
    title: "GDPR export & deletion",
    description:
      "Self-serve data export and right-to-erasure workflows, built to support GDPR and similar regional privacy requirements.",
  },
  {
    icon: KeyRound,
    title: "Granular RBAC",
    description:
      "Role-based permissions down to individual resource actions, so every user and service account has exactly the access it needs.",
  },
];

const deepDives: FeatureDetail[] = [
  {
    icon: ShieldCheck,
    eyebrow: "Security Center",
    title: "Visibility into every session, key, and device",
    description:
      "Security teams get a dedicated console covering active sessions, trusted devices, login history, multi-factor authentication, and API key management — not scattered across settings pages.",
    points: [
      "Revoke any active session or trusted device in one click",
      "Full login history, including method and originating device",
      "Enforce or offer MFA with backup codes for account recovery",
      "Personal and organization API keys, scoped and independently revocable",
    ],
  },
  {
    icon: ClipboardCheck,
    eyebrow: "Compliance Center",
    title: "Compliance workflows your legal team will recognize",
    description:
      "Retention policies, legal holds, consent records, and a cryptographically verifiable audit export — the primitives a real compliance program is built on, available from day one.",
    points: [
      "Retention policies configurable per organization and data type",
      "Legal holds that override retention until explicitly released",
      "Consent record tracking for regional privacy requirements",
      "One-click audit export with independent chain verification",
    ],
  },
];

export default function EnterprisePage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>Enterprise</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              The controls your security review actually asks for
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Voltx was built multi-tenant and audit-ready from the first line of code — not
              retrofitted for a compliance checklist. SSO, tenant isolation, and a full audit
              trail are standard, not an add-on tier.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <a href="/contact">Talk to Sales</a>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <a href={siteConfig.appUrl}>Sign in</a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="container pb-24 sm:pb-32">
        <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((capability) => (
            <StaggerItem key={capability.title}>
              <Card className="h-full p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                  <capability.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-foreground">{capability.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {capability.description}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="container">
        <div className="divide-y divide-border/70">
          {deepDives.map((feature, i) => (
            <FeatureDetailBlock key={feature.title} feature={feature} reverse={i % 2 === 1} />
          ))}
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Enterprise plan</SectionEyebrow>
            <Reveal delay={0.05}>
              <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                What&apos;s included
              </h2>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="mx-auto mt-14 max-w-2xl">
              <Card className="p-8 sm:p-10">
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    "Unlimited seats",
                    "SSO & SCIM provisioning",
                    "Dedicated Solutions Engineer",
                    "99.9% uptime SLA",
                    "Custom data retention",
                    "Priority support with named contacts",
                    "Security & Compliance Centers",
                    "Custom master service agreement",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-foreground/90">
                      <Users className="h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex justify-center">
                  <Button size="lg" asChild>
                    <a href="/contact">Talk to Sales</a>
                  </Button>
                </div>
              </Card>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection
        title="Ready for a rollout built to pass security review?"
        description="Tell us about your team and we'll put together a rollout plan, SSO setup, and pricing tailored to your organization."
      />
    </>
  );
}
