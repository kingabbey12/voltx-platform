import type { Metadata } from "next";
import { Gauge, Headphones, Rocket, Users } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { siteConfig } from "@/config/site";
import { BetaForm } from "./beta-form";

export const metadata: Metadata = {
  title: "Join the Beta",
  description:
    "Request access to the Voltx limited beta. A small group of teams, onboarded personally, with direct access to the people building it.",
  alternates: { canonical: `${siteConfig.url}/join-beta` },
  openGraph: {
    title: "Join the Voltx Beta",
    description:
      "A small group of teams, onboarded personally, with direct access to the people building it.",
    url: `${siteConfig.url}/join-beta`,
  },
};

const betaBenefits = [
  {
    icon: Rocket,
    title: "Early access",
    description: "Use every capability, including features that ship to general availability later.",
  },
  {
    icon: Headphones,
    title: "A direct line",
    description:
      "A shared channel with the team building the product. Not a ticket queue.",
  },
  {
    icon: Users,
    title: "Hands-on onboarding",
    description:
      "We help configure your first agents and workflows rather than pointing you at docs.",
  },
  {
    icon: Gauge,
    title: "Influence the roadmap",
    description:
      "Beta feedback decides what we build next. Small group, so your input carries weight.",
  },
];

export default function JoinBetaPage() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
      />

      <div className="container">
        <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-20">
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <SectionEyebrow>Limited beta</SectionEyebrow>
              <h1 className="text-balance mt-5 text-[2.4rem] font-semibold leading-[1.08] tracking-tight sm:text-[3.2rem]">
                Help shape
                <span className="gradient-text"> what comes next</span>
              </h1>
              <p className="text-pretty mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                We&apos;re onboarding a small number of teams at a time so every one of them
                gets real attention. Tell us what you&apos;d use it for and we&apos;ll be in
                touch as spots open.
              </p>

              <ul className="mt-10 flex flex-col gap-6">
                {betaBenefits.map((item) => (
                  <li key={item.title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                      <item.icon className="h-5 w-5 text-primary" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold">{item.title}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <p className="mt-10 rounded-card border border-border bg-card/40 p-5 text-sm text-muted-foreground">
                Evaluating for a larger team?{" "}
                <a
                  href="/book-demo"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Book a demo
                </a>{" "}
                and we&apos;ll walk through it with you.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-card border border-border bg-card/60 p-6 backdrop-blur sm:p-9">
              <BetaForm />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
