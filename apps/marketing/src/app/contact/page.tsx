import type { Metadata } from "next";
import { Building2, Clock, Mail } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { siteConfig } from "@/config/site";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Talk to the Voltx team about your rollout, book a demo, or reach out with any question about the platform.",
};

const contactPoints = [
  {
    icon: Mail,
    title: "Sales",
    description: "Questions about pricing, plans, or a custom rollout.",
    value: siteConfig.email.sales,
    href: `mailto:${siteConfig.email.sales}`,
  },
  {
    icon: Building2,
    title: "Support",
    description: "Already a customer? Our team typically replies within hours.",
    value: siteConfig.email.support,
    href: `mailto:${siteConfig.email.support}`,
  },
  {
    icon: Clock,
    title: "Response time",
    description: "We respond to every inquiry within one business day.",
    value: "< 24 hours",
    href: undefined,
  },
];

export default function ContactPage() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
      />
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <SectionEyebrow>Contact</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
              Let&apos;s talk about your team
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mt-6 text-lg text-muted-foreground">
              Whether you want a demo, have a question about pricing, or just want to see if
              Voltx is a fit — we&apos;d love to hear from you.
            </p>
          </Reveal>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-12">
          <Reveal className="lg:col-span-2">
            <div className="flex flex-col gap-5">
              {contactPoints.map((point) => (
                <div key={point.title} className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                    <point.icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{point.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{point.description}</p>
                  {point.href ? (
                    <a
                      href={point.href}
                      className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      {point.value}
                    </a>
                  ) : (
                    <p className="mt-3 text-sm font-medium text-primary">{point.value}</p>
                  )}
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="lg:col-span-3">
            <div className="rounded-3xl border border-border bg-card p-8 sm:p-10">
              <ContactForm />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
