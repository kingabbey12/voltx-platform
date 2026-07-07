import type { Metadata } from "next";
import { Compass, Heart, ShieldCheck, Sparkles } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { CtaSection } from "@/components/sections/cta-section";

export const metadata: Metadata = {
  title: "About",
  description:
    "Voltx was built to be the operating system for how modern businesses actually work — AI-native, unified, and built for trust.",
};

const values = [
  {
    icon: Sparkles,
    title: "AI-native, not AI-bolted-on",
    description:
      "Every part of Voltx was designed around what autonomous agents can do — not retrofitted with a chatbot after the fact.",
  },
  {
    icon: ShieldCheck,
    title: "Trust is a feature",
    description:
      "Tenant isolation, role-based access, and human-in-the-loop approvals are core to the product, not an afterthought.",
  },
  {
    icon: Compass,
    title: "Unified over fragmented",
    description:
      "We believe the future of business software is one connected system, not twelve tools stitched together with brittle automations.",
  },
  {
    icon: Heart,
    title: "Built for the people who use it",
    description:
      "Every feature ships after asking whether it removes real work from someone's day — not whether it looks good in a demo.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>About Voltx</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              The operating system for how business actually gets done
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              We started Voltx because the tools businesses rely on — CRM, docs, workflows,
              meetings — were never built to talk to each other, let alone to an AI that could
              act on your behalf across all of them.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Our story</h2>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="mt-6 flex flex-col gap-5 text-base leading-relaxed text-muted-foreground">
              <p>
                Most companies run on a patchwork of CRMs, spreadsheets, chat tools, and
                point automations — each holding a piece of the truth, none of them talking to
                each other. Every new AI feature just became one more disconnected tool.
              </p>
              <p>
                Voltx was built differently: as a single platform where your CRM data, your
                knowledge, your workflows, and your AI agents all share the same context. An
                agent that qualifies a lead can see the account history. A workflow that
                escalates a support ticket can reason about the customer&apos;s entire
                relationship with your business — because it&apos;s all one system.
              </p>
              <p>
                Today, Voltx powers autonomous agents, multi-step workflows, and a living
                knowledge graph for teams who want AI that does real work, not just answers
                questions.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>What we believe</SectionEyebrow>
            <Reveal delay={0.05}>
              <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                Principles that shape every decision
              </h2>
            </Reveal>
          </div>

          <StaggerGroup className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2">
            {values.map((value) => (
              <StaggerItem key={value.title}>
                <div className="h-full rounded-2xl border border-border bg-card p-7">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                    <value.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">{value.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </section>

      <CtaSection
        title="Join us in building it"
        description="Whether you're a customer or a future teammate, we'd love to talk."
      />
    </>
  );
}
