import type { Metadata } from "next";
import {
  BookOpen,
  Boxes,
  Key,
  KeyRound,
  PlayCircle,
  Puzzle,
  TerminalSquare,
  Webhook,
} from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CtaSection } from "@/components/sections/cta-section";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Get started with the Voltx API — authentication, your first request, SDKs, webhooks, and the interactive API reference.",
};

const quickstartSteps = [
  {
    title: "Create a Personal Access Token",
    description:
      "Sign in and open the Developer Portal, then generate a Personal Access Token scoped to what your script needs.",
  },
  {
    title: "Install an SDK",
    description: "Install the official client for your language of choice.",
    code: "npm install @voltx/sdk",
  },
  {
    title: "Make your first request",
    description: "Authenticate with your token and call any endpoint.",
    code: [
      "import { Voltx } from \"@voltx/sdk\";",
      "",
      "const voltx = new Voltx({ apiKey: process.env.VOLTX_API_KEY });",
      "const me = await voltx.auth.me();",
    ].join("\n"),
  },
];

interface DocGuide {
  icon: typeof BookOpen;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}

const guides: DocGuide[] = [
  {
    icon: PlayCircle,
    title: "Interactive API reference",
    description: "The full OpenAPI 3.1 reference with a live request playground, in-app.",
    href: `${siteConfig.appUrl}/developers/api-docs`,
    external: true,
  },
  {
    icon: Key,
    title: "Authentication",
    description: "API keys, personal access tokens, and service accounts — when to use each.",
    href: `${siteConfig.appUrl}/developers/personal-access-tokens`,
    external: true,
  },
  {
    icon: KeyRound,
    title: "OAuth applications",
    description: "Register an app and implement the authorization-code + PKCE flow.",
    href: `${siteConfig.appUrl}/developers/oauth-applications`,
    external: true,
  },
  {
    icon: Webhook,
    title: "Webhooks",
    description: "Subscribe to events, verify signatures, and replay failed deliveries.",
    href: `${siteConfig.appUrl}/developers/webhooks`,
    external: true,
  },
  {
    icon: Boxes,
    title: "SDKs",
    description: "Official clients for TypeScript, Python, and Flutter.",
    href: "/developers",
  },
  {
    icon: TerminalSquare,
    title: "CLI reference",
    description: "Install the Voltx CLI and script deploys, runs, and log streaming.",
    href: "/developers",
  },
  {
    icon: Puzzle,
    title: "Extension Framework",
    description: "Build Custom Pages, Widgets, Nav entries, and AI Tools for the Marketplace.",
    href: "/developers",
  },
  {
    icon: BookOpen,
    title: "Changelog",
    description: "Every API and platform change, in order.",
    href: `${siteConfig.appUrl}/developers/changelog`,
    external: true,
  },
];

export default function DocsPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>Docs</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Start building in minutes
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Everything you need to make your first authenticated request, from a token to a
              response.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Quickstart
            </h2>
          </Reveal>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl flex-col gap-5">
          {quickstartSteps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <Card className="p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
                    {step.code && (
                      <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-background/60 px-4 py-3 text-xs leading-relaxed">
                        <code className="font-mono text-muted-foreground">{step.code}</code>
                      </pre>
                    )}
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3}>
          <div className="mx-auto mt-8 flex max-w-2xl justify-center">
            <Button size="lg" asChild>
              <a href={`${siteConfig.appUrl}/developers/playground`}>Try it in the Playground</a>
            </Button>
          </div>
        </Reveal>
      </section>

      <section className="container pb-24 sm:pb-32">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Guides</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Go deeper
            </h2>
          </Reveal>
        </div>

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => (
            <StaggerItem key={guide.title}>
              <a
                href={guide.href}
                target={guide.external ? "_blank" : undefined}
                rel={guide.external ? "noopener noreferrer" : undefined}
                className="group block h-full"
              >
                <Card className="h-full p-6 transition-colors group-hover:border-primary/40">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                    <guide.icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{guide.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {guide.description}
                  </p>
                </Card>
              </a>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <CtaSection
        title="Questions the docs don't answer?"
        description="Reach out and we'll get you unblocked — usually within one business day."
      />
    </>
  );
}
