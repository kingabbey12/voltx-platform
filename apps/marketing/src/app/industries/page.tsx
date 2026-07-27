import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  Briefcase,
  Building2,
  Factory,
  GraduationCap,
  HeartPulse,
  Landmark,
  ShoppingCart,
  Zap as ZapIcon,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { CtaSection } from "@/components/sections/cta-section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "How teams in financial services, healthcare, manufacturing, professional services, retail and the public sector run their operations on Voltx.",
  alternates: { canonical: `${siteConfig.url}/industries` },
  openGraph: {
    title: "Industries — Voltx",
    description:
      "Purpose-fit deployments for regulated, operations-heavy and high-volume industries.",
    url: `${siteConfig.url}/industries`,
  },
};

const industries = [
  {
    icon: Banknote,
    name: "Financial Services",
    summary:
      "Client onboarding, KYC evidence gathering and relationship management under a full audit trail.",
    outcomes: [
      "Every agent action recorded against an immutable audit log",
      "Retention policies and legal hold enforced per record",
      "Client data isolated at the database layer, not just the application",
    ],
  },
  {
    icon: HeartPulse,
    name: "Healthcare & Life Sciences",
    summary:
      "Referral intake, documentation and care coordination without moving data between disconnected systems.",
    outcomes: [
      "PII registry with field-level classification",
      "Consent records tracked as first-class data",
      "Configurable data residency and retention",
    ],
  },
  {
    icon: Factory,
    name: "Manufacturing & Logistics",
    summary:
      "Supplier communication, quoting and exception handling across sites and time zones.",
    outcomes: [
      "Workflows that wait on approvals without losing state",
      "Dead-letter queues so failed jobs surface instead of vanishing",
      "Integrations to the systems that already run the floor",
    ],
  },
  {
    icon: Briefcase,
    name: "Professional Services",
    summary:
      "Proposals, engagement delivery and knowledge reuse across every client account.",
    outcomes: [
      "Knowledge base agents search across past engagements",
      "Meeting capture that turns into structured follow-up",
      "Per-client permission boundaries",
    ],
  },
  {
    icon: ShoppingCart,
    name: "Retail & E-commerce",
    summary:
      "High-volume customer conversations, order exceptions and supplier coordination.",
    outcomes: [
      "Multi-channel inbox with AI triage and drafting",
      "Sustained throughput measured at ~3,300 requests/second",
      "Workflows triggered by events rather than polling",
    ],
  },
  {
    icon: ZapIcon,
    name: "Energy & Utilities",
    summary:
      "Field coordination, compliance reporting and long-running approval chains.",
    outcomes: [
      "Scheduled work runs exactly once across every replica",
      "Approval gates that pause a workflow safely for days",
      "Full run history for every automated decision",
    ],
  },
  {
    icon: Building2,
    name: "Real Estate & Construction",
    summary:
      "Pipeline, tenant and subcontractor communication, and document-heavy processes.",
    outcomes: [
      "Attachment pipeline with virus scanning and text extraction",
      "Structured records linked to source documents",
      "Automated follow-up on stalled deals",
    ],
  },
  {
    icon: GraduationCap,
    name: "Education",
    summary:
      "Admissions, student services and staff workflows on shared institutional knowledge.",
    outcomes: [
      "SSO and SCIM provisioning against your directory",
      "Role-based access down to individual permissions",
      "Knowledge retrieval grounded in your own material",
    ],
  },
  {
    icon: Landmark,
    name: "Public Sector",
    summary:
      "Case handling and citizen correspondence where every action must be accountable.",
    outcomes: [
      "Exportable audit history for oversight requests",
      "Self-hostable deployment topology",
      "No customer data used for model training, ever",
    ],
  },
];

export default function IndustriesPage() {
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
              <SectionEyebrow>Industries</SectionEyebrow>
              <h1 className="text-balance mt-5 text-[2.5rem] font-semibold leading-[1.06] tracking-tight sm:text-[3.5rem]">
                Built for the work
                <span className="gradient-text"> your industry actually does</span>
              </h1>
              <p className="text-pretty mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                The platform is the same everywhere. What changes is which capabilities
                matter most — audit depth in financial services, data residency in
                healthcare, throughput in retail.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {industries.map((industry, index) => (
              <Reveal key={industry.name} delay={index * 0.05}>
                <article className="flex h-full flex-col rounded-card border border-border bg-card/50 p-7 transition-colors hover:border-primary/40">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <industry.icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold">{industry.name}</h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {industry.summary}
                  </p>
                  <ul className="mt-5 flex flex-col gap-2.5 border-t border-border pt-5">
                    {industry.outcomes.map((outcome) => (
                      <li
                        key={outcome}
                        className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span
                          aria-hidden
                          className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70"
                        />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-16 flex flex-col items-center gap-4 rounded-card border border-border bg-card/40 p-10 text-center">
              <h2 className="text-xl font-semibold">Not seeing your industry?</h2>
              <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
                These are where we have the most experience, not the limits of the
                platform. Tell us what your team does and we&apos;ll tell you honestly
                whether it fits.
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href="/book-demo">Book a demo</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link href="/contact">Ask a question</Link>
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
