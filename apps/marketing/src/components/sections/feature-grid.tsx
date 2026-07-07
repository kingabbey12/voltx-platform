import {
  Bot,
  Calendar,
  Network,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const coreFeatures: Feature[] = [
  {
    icon: Bot,
    title: "AI Agents",
    description:
      "Deploy autonomous agents that reason, plan, call tools, and collaborate with each other to get real work done — not just answer questions.",
  },
  {
    icon: Users,
    title: "CRM",
    description:
      "A modern CRM built for the AI era. Companies, contacts, opportunities, and activities stay perfectly in sync with every conversation.",
  },
  {
    icon: Workflow,
    title: "Workflows",
    description:
      "Compose multi-step automations with approvals, conditions, retries, and AI reasoning steps — visually, without writing a line of code.",
  },
  {
    icon: Network,
    title: "Knowledge",
    description:
      "A living knowledge graph that connects your documents, conversations, and records — so every answer is grounded in your real business data.",
  },
  {
    icon: Calendar,
    title: "Meetings",
    description:
      "Automatic meeting summaries, action items, and follow-ups — synced straight into your CRM and workflows without manual entry.",
  },
  {
    icon: Zap,
    title: "Automation",
    description:
      "Connect your existing tools and let Voltx orchestrate the busywork across every system your business already runs on.",
  },
];

export function FeatureGrid() {
  return (
    <section className="py-24 sm:py-32" id="features">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Platform</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              Everything your team needs, working as one
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mt-4 text-lg text-muted-foreground">
              Voltx unifies the tools your business already depends on into a single, intelligent
              operating layer.
            </p>
          </Reveal>
        </div>

        <StaggerGroup className="mt-16 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreFeatures.map((feature) => (
            <StaggerItem key={feature.title}>
              <FeatureCard feature={feature} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

export function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-7 transition-colors duration-300 hover:border-primary/30">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
        <feature.icon className="h-5 w-5" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-foreground">{feature.title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
    </div>
  );
}
