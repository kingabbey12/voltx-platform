import type { Metadata } from "next";
import Link from "next/link";
import {
  Database,
  Eye,
  FileLock2,
  Fingerprint,
  KeyRound,
  Network,
  ScrollText,
  ServerCog,
  Trash2,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { CtaSection } from "@/components/sections/cta-section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Security",
  description:
    "How Voltx protects your data: dual-layer tenant isolation, RBAC, SSO and SCIM, encryption at rest, audit logging, retention and legal hold.",
  alternates: { canonical: `${siteConfig.url}/security` },
  openGraph: {
    title: "Security — Voltx",
    description:
      "Tenant isolation enforced in the database layer, not just the application.",
    url: `${siteConfig.url}/security`,
  },
};

const pillars = [
  {
    icon: Database,
    title: "Tenant isolation, twice",
    description:
      "Every request resolves an organization context before any handler runs, and a database-layer extension independently injects that scope into queries across every multi-tenant model. A missing check in application code cannot leak another tenant's data, because the second layer does not depend on the first.",
  },
  {
    icon: Fingerprint,
    title: "Authentication",
    description:
      "SAML and OIDC single sign-on against your identity provider, SCIM provisioning and deprovisioning, TOTP multi-factor with backup codes, trusted-device management, and short-lived access tokens with rotating refresh tokens.",
  },
  {
    icon: KeyRound,
    title: "Authorization",
    description:
      "Role-based access control with per-organization roles and granular resource.action permissions. Every protected route composes authentication, membership resolution and tenant enforcement — including AI agents, which can never exceed the permissions of the user they run for.",
  },
  {
    icon: FileLock2,
    title: "Encryption",
    description:
      "TLS in transit. Integration credentials, OAuth tokens, API keys and webhook secrets are encrypted at rest with a dedicated key, with support for key rotation via a previous-key window so re-encryption needs no downtime.",
  },
  {
    icon: ScrollText,
    title: "Audit logging",
    description:
      "Security-relevant actions are recorded with actor, organization, resource and request id — including actions taken by agents. Logs are exportable, and correlate to application logs through a shared request identifier.",
  },
  {
    icon: Trash2,
    title: "Retention and legal hold",
    description:
      "Configurable retention policies per data class, legal hold that suspends deletion for named records, and consent records tracked as first-class data with a PII registry classifying sensitive fields.",
  },
  {
    icon: Network,
    title: "Outbound request control",
    description:
      "Any feature that fetches a user-supplied URL — workflow steps, webhooks, agent tools — resolves DNS and blocks private and link-local ranges before connecting, including on redirects, so internal services and cloud metadata endpoints stay unreachable.",
  },
  {
    icon: ServerCog,
    title: "Operational security",
    description:
      "Dependency audits block the build on any high-severity advisory. The metrics endpoint is authenticated. Secrets are supplied by environment and never committed, and the application refuses to start in production if required security configuration is missing.",
  },
  {
    icon: Eye,
    title: "Your data stays yours",
    description:
      "Customer data is never used to train foundation models and is never shared between tenants. You can bring your own AI provider keys, and export all of your data in open formats at any time.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>Security</SectionEyebrow>
              <h1 className="text-balance mt-5 text-[2.5rem] font-semibold leading-[1.06] tracking-tight sm:text-[3.5rem]">
                Isolation enforced where it
                <span className="gradient-text"> cannot be forgotten</span>
              </h1>
              <p className="text-pretty mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Most multi-tenant breaches are a missing filter in one query. We assume
                that will eventually happen and put the boundary somewhere application
                code cannot bypass.
              </p>
            </div>
          </Reveal>

          <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 0.05}>
                <article className="flex h-full flex-col rounded-card border border-border bg-card/50 p-7 transition-colors hover:border-primary/40">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <pillar.icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold">{pillar.title}</h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {pillar.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>

          {/* Being straight about certification status is worth more to a security
              reviewer than a wall of badges, and it is what we can actually stand
              behind today. */}
          <Reveal delay={0.1}>
            <div className="mt-16 rounded-card border border-border bg-card/40 p-8 sm:p-10">
              <h2 className="text-xl font-semibold">Where we are on certification</h2>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Voltx is in limited beta and does not yet hold a SOC 2 Type II or ISO
                27001 certification — we would rather tell you that than imply otherwise.
                The controls above are implemented today and we are happy to walk a
                security reviewer through any of them, answer a vendor questionnaire, or
                discuss self-hosted deployment if your requirements need it now.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/contact">Talk to us about security</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <a href={`mailto:${siteConfig.email.support}`}>Report a vulnerability</a>
                </Button>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Found something? Email{" "}
                <a
                  href={`mailto:${siteConfig.email.support}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {siteConfig.email.support}
                </a>{" "}
                and we will acknowledge within one business day. Please give us a
                reasonable window to fix an issue before disclosing it publicly.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
