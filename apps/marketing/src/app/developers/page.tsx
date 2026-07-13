import type { Metadata } from "next";
import {
  Blocks,
  Boxes,
  Code2,
  KeyRound,
  Key,
  Puzzle,
  TerminalSquare,
  Webhook,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { FeatureDetailBlock, type FeatureDetail } from "@/components/sections/feature-detail";
import { CtaSection } from "@/components/sections/cta-section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Developers",
  description:
    "A public REST API, OAuth applications, outbound webhooks, official SDKs for TypeScript, Python, and Flutter, a CLI, and a marketplace — build on Voltx directly.",
};

interface Capability {
  icon: typeof Code2;
  title: string;
  description: string;
}

const capabilities: Capability[] = [
  {
    icon: Code2,
    title: "Public REST API",
    description:
      "A fully documented, OpenAPI 3.1-described REST API with URI versioning, powering everything the Voltx product itself runs on.",
  },
  {
    icon: Key,
    title: "API keys, PATs & service accounts",
    description:
      "Scoped API keys for integrations, personal access tokens for individual developers, and service accounts for machine-to-machine access.",
  },
  {
    icon: KeyRound,
    title: "OAuth applications",
    description:
      "Register an OAuth app and let your users authorize your integration with the full authorization-code + PKCE flow — no shared credentials.",
  },
  {
    icon: Webhook,
    title: "Outbound webhooks",
    description:
      "Subscribe to real events, verify every delivery with HMAC signatures, and replay any delivery from a full log — retries included.",
  },
  {
    icon: Boxes,
    title: "Official SDKs",
    description:
      "First-party SDKs for TypeScript, Python, and Flutter, generated from the same OpenAPI document the API itself is described by.",
  },
  {
    icon: TerminalSquare,
    title: "Voltx CLI",
    description:
      "Log in, deploy a workflow, stream logs, and publish to the marketplace — all from your terminal, scriptable in CI.",
  },
  {
    icon: Puzzle,
    title: "Extension Framework",
    description:
      "Ship Custom Pages, Widgets, Nav entries, and AI Tools that install directly into a customer's Voltx workspace — no forked UI.",
  },
  {
    icon: Blocks,
    title: "Marketplace",
    description:
      "Publish apps for other organizations to install, with real Stripe Connect revenue sharing on paid listings.",
  },
];

const deepDives: FeatureDetail[] = [
  {
    icon: Boxes,
    eyebrow: "SDKs & CLI",
    title: "Reach for a real client, not raw fetch calls",
    description:
      "Every SDK wraps auth, retries, and error handling around the same public API — so you're never hand-rolling HTTP calls or guessing at response shapes.",
    points: [
      "TypeScript, Python, and Flutter SDKs with typed request/response models",
      "Automatic auth header injection for API keys, PATs, and OAuth tokens",
      "The Voltx CLI for scripting deploys, workflow runs, and log streaming",
      "Webhook signature verification helpers included in every SDK",
    ],
  },
  {
    icon: Puzzle,
    eyebrow: "Marketplace & Extensions",
    title: "Ship an app your customers install, not a link they click",
    description:
      "The Extension Framework renders your Custom Pages and Widgets through Voltx's own fixed component palette — installed apps look native because they render through the same system every first-party screen does.",
    points: [
      "Declarative manifests: no arbitrary code runs in a customer's workspace",
      "Data bindings execute under the installing organization's own session",
      "Custom AI Tools register directly into the AI runtime's tool registry",
      "Real revenue sharing on paid installs via Stripe Connect",
    ],
  },
];

export default function DevelopersPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <Reveal>
              <SectionEyebrow>Developers</SectionEyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-balance mx-auto mt-6 max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl lg:mx-0">
                Build on the same platform Voltx runs on
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-pretty mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
                A public API, official SDKs, a CLI, and a marketplace to publish what you build —
                every capability documented here is one your customers already run on.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Button size="lg" asChild>
                  <a href={`${siteConfig.appUrl}/developers`}>Open Developer Portal</a>
                </Button>
                <Button size="lg" variant="secondary" asChild>
                  <a href="/docs">Read the docs</a>
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <Card className="overflow-hidden p-0">
              <div className="flex items-center gap-1.5 border-b border-border px-5 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
                <span className="ml-2 text-xs text-muted-foreground">install.ts</span>
              </div>
              <pre className="overflow-x-auto px-5 py-6 text-left text-sm leading-relaxed">
                <code className="font-mono text-muted-foreground">
                  <span className="text-primary">import</span> {"{ Voltx }"}{" "}
                  <span className="text-primary">from</span>{" "}
                  <span className="text-foreground">&quot;@voltx/sdk&quot;</span>
                  {"\n\n"}
                  <span className="text-primary">const</span> voltx = <span className="text-primary">new</span>{" "}
                  Voltx({"{"}
                  {"\n"}
                  {"  "}apiKey: process.env.VOLTX_API_KEY,{"\n"}
                  {"}"});{"\n\n"}
                  <span className="text-primary">const</span> lead = <span className="text-primary">await</span>{" "}
                  voltx.sales.leads.create({"{"}
                  {"\n"}
                  {"  "}name: <span className="text-foreground">&quot;Jane Cooper&quot;</span>,{"\n"}
                  {"  "}company: <span className="text-foreground">&quot;Acme Inc.&quot;</span>,{"\n"}
                  {"}"});
                </code>
              </pre>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="container py-24 sm:py-32">
        <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((capability) => (
            <StaggerItem key={capability.title}>
              <Card className="h-full p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                  <capability.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{capability.title}</h3>
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

      <CtaSection
        title="Ready to build on Voltx?"
        description="Grab an API key from the Developer Portal and make your first request in minutes."
      />
    </>
  );
}
