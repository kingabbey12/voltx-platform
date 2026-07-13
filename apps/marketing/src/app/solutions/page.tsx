import type { Metadata } from "next";
import {
  ArrowRight,
  Banknote,
  Headset,
  ShieldCheck,
  TerminalSquare,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { FeatureDetailBlock, type FeatureDetail } from "@/components/sections/feature-detail";
import { CtaSection } from "@/components/sections/cta-section";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "How Sales, Support, Operations, IT, Finance, and Developer teams each run on Voltx — one platform, tuned to how your team actually works.",
};

interface TeamSolution {
  icon: typeof TrendingUp;
  eyebrow: string;
  title: string;
  outcomes: string[];
}

const teamSolutions: TeamSolution[] = [
  {
    icon: TrendingUp,
    eyebrow: "Sales",
    title: "Pipeline that runs itself between calls",
    outcomes: [
      "AI-qualified leads and next-best-actions on every opportunity",
      "Companies, contacts, and activities in one connected CRM",
      "Follow-ups drafted the moment a call ends",
    ],
  },
  {
    icon: Headset,
    eyebrow: "Support & Success",
    title: "One inbox for every channel, one AI on every reply",
    outcomes: [
      "Email, Slack, and Teams unified into a single shared inbox",
      "AI-drafted responses grounded in your knowledge graph",
      "Customer context follows the conversation automatically",
    ],
  },
  {
    icon: Workflow,
    eyebrow: "Operations",
    title: "Automation with approvals, not just triggers",
    outcomes: [
      "Multi-step workflows with conditions, retries, and delays",
      "Human-in-the-loop approvals for anything sensitive",
      "Full run history — see exactly what happened and why",
    ],
  },
  {
    icon: ShieldCheck,
    eyebrow: "IT & Security",
    title: "Enterprise controls without enterprise friction",
    outcomes: [
      "SSO and SCIM provisioning that IT can set up in an afternoon",
      "Tenant isolation enforced at the database layer, not just the UI",
      "A full audit trail for every action, exportable on demand",
    ],
  },
  {
    icon: Banknote,
    eyebrow: "Finance",
    title: "Usage and billing you can actually forecast",
    outcomes: [
      "Seat and usage-based billing with clear per-plan limits",
      "Self-serve upgrades, downgrades, and invoice history",
      "No surprise overages — usage metering is visible in real time",
    ],
  },
  {
    icon: TerminalSquare,
    eyebrow: "Developers & Platform",
    title: "A platform your team can build on top of",
    outcomes: [
      "A documented public API, OAuth apps, and outbound webhooks",
      "Official SDKs for TypeScript, Python, and Flutter, plus a CLI",
      "A marketplace and extension framework for internal or shared apps",
    ],
  },
];

const deepDives: FeatureDetail[] = [
  {
    icon: TrendingUp,
    eyebrow: "Sales",
    title: "Every rep gets an AI copilot, not another dashboard",
    description:
      "Voltx's Sales Copilot works inside your existing pipeline — reading opportunity context, drafting the next message, and flagging deals that need attention before they go quiet.",
    points: [
      "Lead scoring and qualification that updates as new activity comes in",
      "AI-drafted follow-ups matched to each deal's stage and history",
      "One pipeline view across companies, contacts, and opportunities",
      "Activity timeline that captures calls, emails, and meeting outcomes",
    ],
  },
  {
    icon: ShieldCheck,
    eyebrow: "IT & Security",
    title: "The controls your security review actually asks for",
    description:
      "Voltx was built multi-tenant from day one — organization data is isolated at the database layer, not just filtered in application code, with a full compliance toolset for regulated teams.",
    points: [
      "SSO and SCIM provisioning for centralized identity management",
      "Row-level tenant isolation enforced by the ORM, independent of the API",
      "A Security Center for sessions, trusted devices, MFA, and login history",
      "A Compliance Center for legal holds, retention policies, and audit export",
    ],
  },
];

export default function SolutionsPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>Solutions</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Built for how every team actually works
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Voltx isn&apos;t six different tools stitched together. It&apos;s one platform that
              adapts to Sales, Support, Operations, IT, Finance, and Engineering — with the same
              data and the same AI underneath every team.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container pb-24 sm:pb-32">
        <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {teamSolutions.map((team) => (
            <StaggerItem key={team.eyebrow}>
              <Card className="flex h-full flex-col p-7">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                  <team.icon className="h-5 w-5" />
                </div>
                <span className="mt-5 text-xs font-medium uppercase tracking-wide text-primary">
                  {team.eyebrow}
                </span>
                <h3 className="mt-2 text-lg font-semibold text-foreground">{team.title}</h3>
                <ul className="mt-4 flex flex-1 flex-col gap-2.5">
                  {team.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {outcome}
                    </li>
                  ))}
                </ul>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="container">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>A closer look</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              Two teams, two very different days
            </h2>
          </Reveal>
        </div>
        <div className="divide-y divide-border/70">
          {deepDives.map((feature, i) => (
            <FeatureDetailBlock key={feature.title} feature={feature} reverse={i % 2 === 1} />
          ))}
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container">
          <Reveal>
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-3xl border border-primary/20 bg-primary/5 px-8 py-10 text-center">
              <p className="text-balance text-xl font-semibold text-foreground sm:text-2xl">
                Not sure which plan fits your team?
              </p>
              <p className="text-pretty max-w-lg text-sm text-muted-foreground">
                Every Voltx plan includes the full platform — Sales, Support, Operations, and
                Developer tools all come standard. Pricing scales with seats, not features.
              </p>
              <a
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                See pricing
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
