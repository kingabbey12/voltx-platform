import type { Metadata } from "next";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { PricingTable } from "@/components/sections/pricing-table";
import { CtaSection } from "@/components/sections/cta-section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for teams of every size — from a free forever plan to custom enterprise agreements.",
};

const faqs = [
  {
    question: "Is there really a free plan?",
    answer:
      "Yes. The Starter plan is free forever for up to 10 seats with core CRM and a single AI agent — no credit card required.",
  },
  {
    question: "How does AI usage factor into pricing?",
    answer:
      "Seat pricing covers the platform and core AI features. Enterprise plans are quoted with projected AI usage volume in mind since compute is the primary variable cost driver at scale.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes, you can upgrade or downgrade at any time. Annual plans are prorated, and you'll never lose your data when switching tiers.",
  },
  {
    question: "Do you offer discounts for annual billing?",
    answer:
      "Annual billing saves 20% compared to monthly across every paid tier, and multi-year enterprise agreements unlock additional price-lock protection.",
  },
  {
    question: "What does the Enterprise plan include?",
    answer:
      "Unlimited seats, SSO/SCIM provisioning, custom data retention, a dedicated Solutions Engineer, and a named support SLA backed by a 99.9% uptime commitment.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>Pricing</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Simple pricing that scales with you
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Start free. Upgrade when your team is ready for the full AI workspace. No hidden
              fees, ever.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container pb-24 sm:pb-32">
        <PricingTable />
      </section>

      <section className="py-24 sm:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <Reveal delay={0.05}>
              <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                Frequently asked questions
              </h2>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="mx-auto mt-14 max-w-2xl">
              <Accordion type="single" collapsible>
                {faqs.map((faq, i) => (
                  <AccordionItem key={faq.question} value={`item-${i}`}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent>{faq.answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  );
}
