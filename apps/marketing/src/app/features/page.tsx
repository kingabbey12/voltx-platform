import type { Metadata } from "next";
import {
  Bot,
  Calendar,
  Lock,
  Network,
  Plug,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { FeatureDetailBlock, type FeatureDetail } from "@/components/sections/feature-detail";
import { CtaSection } from "@/components/sections/cta-section";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore Voltx's AI agents, CRM, workflow automation, knowledge graph, meeting intelligence, and integrations — built as one unified platform.",
};

const features: FeatureDetail[] = [
  {
    icon: Bot,
    eyebrow: "AI Agents",
    title: "Autonomous agents that get real work done",
    description:
      "Voltx agents don't just chat — they reason step by step, call tools, retrieve context, and hand off to specialist agents when a task needs it.",
    points: [
      "Multi-step planning with tool execution and observability",
      "Multi-agent delegation for complex, cross-functional tasks",
      "Per-agent memory, permissions, and cost tracking",
      "Streaming responses with full audit trails",
    ],
  },
  {
    icon: Users,
    eyebrow: "CRM",
    title: "A CRM that understands context, not just fields",
    description:
      "Companies, contacts, leads, opportunities, and activities live in one connected system that your AI agents can act on directly.",
    points: [
      "Pipeline and activity tracking built for fast-moving teams",
      "AI-drafted follow-ups, qualification, and next-best-actions",
      "Full activity history: calls, emails, meetings, notes, tasks",
      "Role-based access across every organization you manage",
    ],
  },
  {
    icon: Workflow,
    eyebrow: "Workflows",
    title: "Automation with governance built in",
    description:
      "Compose multi-step workflows — including AI reasoning steps — with conditions, retries, approvals, and dead-letter handling.",
    points: [
      "Visual step composition: tools, APIs, conditions, delays, AI agents",
      "Human-in-the-loop approval steps for sensitive actions",
      "Automatic retries with backoff and dead-letter recovery",
      "Full execution history and per-run observability",
    ],
  },
  {
    icon: Network,
    eyebrow: "Knowledge",
    title: "A knowledge graph grounded in your business",
    description:
      "Every document, conversation, and CRM record feeds a living knowledge graph — so answers are grounded, cited, and always current.",
    points: [
      "Hybrid semantic + keyword search with source citations",
      "Automatic entity and relationship mapping across your data",
      "Ingests documents, CRM records, and conversation history",
      "Powers retrieval for every agent and workflow automatically",
    ],
  },
  {
    icon: Calendar,
    eyebrow: "Meetings",
    title: "Meetings that turn into action, not notes",
    description:
      "Voltx captures meeting outcomes and automatically creates the follow-up activities, tasks, and CRM updates that used to take an hour.",
    points: [
      "Automatic meeting summaries linked to the right CRM records",
      "Action items converted directly into tasks and workflows",
      "Searchable meeting history inside your knowledge graph",
      "Zero manual data entry after a call",
    ],
  },
  {
    icon: Zap,
    eyebrow: "Automation",
    title: "Your tools, orchestrated in one place",
    description:
      "Connect the systems your business already runs on and let Voltx coordinate the busywork across every one of them.",
    points: [
      "Native integrations for messaging, calendar, and dev tools",
      "Webhook and REST connections for anything else",
      "Encrypted credential storage for every connection",
      "Health checks and usage monitoring per integration",
    ],
  },
];

const platformCapabilities = [
  {
    icon: Lock,
    title: "Enterprise-grade security",
    description:
      "Tenant isolation enforced at the database layer, role-based access control, and encrypted credentials by default.",
  },
  {
    icon: Users,
    title: "Multi-organization support",
    description:
      "Switch between organizations without losing your session — every workspace, agent, and integration reloads instantly.",
  },
  {
    icon: Plug,
    title: "Built to integrate",
    description:
      "A documented API and webhook system so Voltx fits into the stack you already have, not the other way around.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>Features</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              One platform. Every part of your business.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Voltx replaces a stack of disconnected tools with a single AI-native operating
              system — so your team spends less time switching apps and more time deciding.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container">
        <div className="divide-y divide-border/70">
          {features.map((feature, i) => (
            <FeatureDetailBlock key={feature.title} feature={feature} reverse={i % 2 === 1} />
          ))}
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Under the hood</SectionEyebrow>
            <Reveal delay={0.05}>
              <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                Built for how real businesses operate
              </h2>
            </Reveal>
          </div>

          <StaggerGroup className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {platformCapabilities.map((capability) => (
              <StaggerItem key={capability.title}>
                <div className="h-full rounded-2xl border border-border bg-card p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                    <capability.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    {capability.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {capability.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
