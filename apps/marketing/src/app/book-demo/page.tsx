import type { Metadata } from "next";
import { CalendarCheck, MessagesSquare, ShieldCheck, Sparkles } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { siteConfig } from "@/config/site";
import { DemoForm } from "./demo-form";

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "See Voltx applied to your business. A 30-minute working session with a solutions engineer — no slides, no generic walkthrough.",
  alternates: { canonical: `${siteConfig.url}/book-demo` },
  openGraph: {
    title: "Book a Demo — Voltx",
    description:
      "A 30-minute working session with a solutions engineer, tailored to your team's workflows.",
    url: `${siteConfig.url}/book-demo`,
  },
};

const whatToExpect = [
  {
    icon: MessagesSquare,
    title: "A conversation, not a pitch",
    description:
      "We start with the work your team actually does today and where it breaks down.",
  },
  {
    icon: Sparkles,
    title: "Your workflows, live",
    description:
      "We build an agent or workflow against your real scenario during the call.",
  },
  {
    icon: ShieldCheck,
    title: "Straight answers on security",
    description:
      "Tenant isolation, data residency, retention, SSO and audit — bring your questionnaire.",
  },
  {
    icon: CalendarCheck,
    title: "A concrete next step",
    description: "A rollout plan sized to your team, or an honest no if we're not the right fit.",
  },
];

export default function BookDemoPage() {
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
              <SectionEyebrow>Book a demo</SectionEyebrow>
              <h1 className="text-balance mt-5 text-[2.4rem] font-semibold leading-[1.08] tracking-tight sm:text-[3.2rem]">
                See Voltx running on
                <span className="gradient-text"> your business</span>
              </h1>
              <p className="text-pretty mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
                Thirty minutes with a solutions engineer who has built this before. Tell us
                what you&apos;re trying to fix and we&apos;ll show you exactly how it works —
                or tell you if it doesn&apos;t.
              </p>

              <ul className="mt-10 flex flex-col gap-6">
                {whatToExpect.map((item) => (
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
                Not ready for a call?{" "}
                <a
                  href="/join-beta"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Join the beta
                </a>{" "}
                and get hands-on access yourself.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-card border border-border bg-card/60 p-6 backdrop-blur sm:p-9">
              <DemoForm />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
