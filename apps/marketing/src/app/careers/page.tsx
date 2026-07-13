import type { Metadata } from "next";
import { Suspense } from "react";
import { Compass, Globe2, Heart, Rocket, Users } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { jobListings } from "@/lib/careers";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = {
  title: "Careers",
  description:
    "Join the team building Voltx — an AI-native business operating system. Open roles across engineering, AI, sales, and design.",
};

const values = [
  {
    icon: Rocket,
    title: "Ship real things",
    description: "We measure progress in shipped, production-quality work — not roadmap slides.",
  },
  {
    icon: Compass,
    title: "Own the outcome",
    description: "Every person here owns problems end to end, not just a ticket in a sprint.",
  },
  {
    icon: Heart,
    title: "Default to candor",
    description: "Direct, respectful feedback beats polite silence — for the work and for each other.",
  },
  {
    icon: Globe2,
    title: "Remote, by design",
    description: "We hired remote-first from day one — not as a pandemic accommodation.",
  },
];

export default function CareersPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>Careers</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Help build the AI operating system for business
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              We&apos;re a small, remote-first team building Voltx end to end — from tenant
              isolation in the database to the agent runtime to the pixels on screen.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container pb-20">
        <StaggerGroup className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((value) => (
            <StaggerItem key={value.title}>
              <Card className="h-full p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                  <value.icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {value.description}
                </p>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>

      <section className="container pb-24 sm:pb-32">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Open roles</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              {jobListings.length} open positions
            </h2>
          </Reveal>
        </div>

        <div className="mx-auto mt-14 flex max-w-3xl flex-col gap-4">
          {jobListings.map((job) => (
            <Reveal key={job.id}>
              <Card className="p-6 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                      <Badge variant="accent">{job.department}</Badge>
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {job.location} &middot; {job.type}
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                      {job.description}
                    </p>
                  </div>
                  <a
                    href={`/careers?role=${job.id}#apply-form`}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg border border-primary/60 bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    Apply
                  </a>
                </div>
                <ul className="mt-5 flex flex-col gap-2 border-t border-border/70 pt-5">
                  {job.requirements.map((requirement) => (
                    <li
                      key={requirement}
                      className="flex items-start gap-2.5 text-sm text-muted-foreground"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="apply-form" className="container pb-24 sm:pb-32">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow>Apply</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Tell us about yourself
            </h2>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mx-auto mt-12 max-w-2xl">
            <Card className="p-8 sm:p-10">
              <Suspense fallback={null}>
                <ApplicationForm jobs={jobListings} />
              </Suspense>
            </Card>
          </div>
        </Reveal>
      </section>
    </>
  );
}
