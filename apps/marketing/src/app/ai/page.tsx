import type { Metadata } from "next";
import Link from "next/link";
import {
  Blocks,
  BookOpenCheck,
  Bot,
  GitBranch,
  Layers,
  Radio,
  ScrollText,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { CtaSection } from "@/components/sections/cta-section";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "AI Capabilities",
  description:
    "Autonomous agents, function calling, long-term memory, grounded retrieval and multi-agent orchestration — provider-agnostic across Anthropic, OpenAI and Google.",
  alternates: { canonical: `${siteConfig.url}/ai` },
  openGraph: {
    title: "AI Capabilities — Voltx",
    description:
      "Agents that act on your data, with the governance to let them.",
    url: `${siteConfig.url}/ai`,
  },
};

const capabilities = [
  {
    icon: Bot,
    title: "Autonomous agents",
    description:
      "Agents run a full reasoning loop — plan, call tools, observe results, decide the next step — rather than answering once. Each run is bounded by iteration, tool-call and time limits you set.",
  },
  {
    icon: Wrench,
    title: "Tool calling with permissions",
    description:
      "Agents act through a registry of typed tools, and every tool call is checked against the agent's allowlist and the acting user's own permissions. An agent can never exceed the person it runs for.",
  },
  {
    icon: BookOpenCheck,
    title: "Grounded retrieval",
    description:
      "Answers are grounded in your documents through hybrid semantic and keyword search with graph traversal, so responses cite your material instead of inventing it.",
  },
  {
    icon: Layers,
    title: "Long-term memory",
    description:
      "Conversations are scored and summarised so relevant history is carried into later runs. Memory is selected by relevance, not simply appended until the context window fills.",
  },
  {
    icon: GitBranch,
    title: "Multi-agent orchestration",
    description:
      "A coordinating agent delegates to specialists and merges their results, with configurable depth, parallelism and total agent count so a run cannot fan out indefinitely.",
  },
  {
    icon: Blocks,
    title: "Provider-agnostic",
    description:
      "Anthropic, OpenAI and Google behind one interface. Bring your own keys, route different workloads to different models, and switch provider without touching your agents.",
  },
  {
    icon: Radio,
    title: "Streaming by default",
    description:
      "Responses stream token by token over SSE with heartbeats and resumable event ids, so a slow tool call or a dropped connection doesn't lose the run.",
  },
  {
    icon: ShieldCheck,
    title: "Human approval gates",
    description:
      "Mutating actions can require explicit sign-off. The run pauses, waits for a decision — for days if needed — then resumes exactly where it stopped.",
  },
  {
    icon: ScrollText,
    title: "Complete run history",
    description:
      "Every step, tool call, token count and cost is recorded per run and per tenant. You can answer what an agent did, why, and what it spent.",
  },
];

const governance = [
  "Tenant isolation enforced in the ORM layer, independently of application code",
  "Per-organization AI credentials, so your keys and spend stay yours",
  "Usage and cost metered per organization and per feature",
  "No customer data is ever used to train foundation models",
];

export default function AiCapabilitiesPage() {
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
              <SectionEyebrow>AI capabilities</SectionEyebrow>
              <h1 className="text-balance mt-5 text-[2.5rem] font-semibold leading-[1.06] tracking-tight sm:text-[3.5rem]">
                Agents that act on your business
                <span className="gradient-text"> — and the governance to let them</span>
              </h1>
              <p className="text-pretty mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                A chatbot answers questions. An agent does the work: reads the record,
                searches the knowledge base, triggers the workflow, and leaves an audit
                trail behind it.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/book-demo">See it on your data</Link>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <Link href="/join-beta">Join the beta</Link>
                </Button>
              </div>
            </div>
          </Reveal>

          <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability, index) => (
              <Reveal key={capability.title} delay={index * 0.05}>
                <article className="flex h-full flex-col rounded-card border border-border bg-card/50 p-7 transition-colors hover:border-primary/40">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                    <capability.icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <h2 className="mt-5 text-lg font-semibold">{capability.title}</h2>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {capability.description}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1}>
            <div className="mt-16 rounded-card border border-border bg-card/40 p-8 sm:p-10">
              <h2 className="text-xl font-semibold">Governed by default</h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                The reason agents can be trusted with real operations is that the
                constraints are enforced below them, not requested of them.
              </p>
              <ul className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {governance.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
                  >
                    <ShieldCheck
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary/80"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-7 text-sm text-muted-foreground">
                More detail on{" "}
                <Link
                  href="/security"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  how we handle security and data
                </Link>
                .
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
