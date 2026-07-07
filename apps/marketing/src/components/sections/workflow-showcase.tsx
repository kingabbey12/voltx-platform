import { Bot, GitBranch, MessageSquareText, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";

const steps = [
  {
    icon: MessageSquareText,
    title: "Ask, in plain language",
    description:
      "Tell Voltx what you need — qualify a lead, summarize a quarter, draft a follow-up. No dashboards to learn, no fields to configure.",
  },
  {
    icon: Bot,
    title: "Agents reason and act",
    description:
      "Your AI agents plan the steps, call the right tools, pull context from your knowledge graph, and delegate to specialists when needed.",
  },
  {
    icon: GitBranch,
    title: "Workflows keep it consistent",
    description:
      "Every action runs through governed workflows with approvals and audit trails — so autonomy never means losing control.",
  },
];

export function WorkflowShowcase() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.25] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_0%,transparent_70%)]"
      />
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>How it works</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              From intent to outcome, autonomously
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mt-4 text-lg text-muted-foreground">
              Voltx agents don&apos;t just respond — they reason, delegate, and execute across
              your entire business context.
            </p>
          </Reveal>
        </div>

        <div className="relative mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-10 md:grid-cols-3">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.15}>
              <div className="relative flex flex-col items-center text-center md:items-start md:text-left">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-background text-primary shadow-[0_0_0_6px_hsl(var(--background))]">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="mx-auto mt-16 flex max-w-lg items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm text-primary">
            <Sparkles className="h-4 w-4" />
            Multi-agent coordination is built in, not bolted on
          </div>
        </Reveal>
      </div>
    </section>
  );
}
