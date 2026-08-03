import { Reveal } from "@/components/motion/reveal";
import { createPageMetadata } from "@/lib/metadata";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { PricingTable } from "@/components/sections/pricing-table";
import { CtaSection } from "@/components/sections/cta-section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const metadata = createPageMetadata(
  "Pricing",
  "Transparent monthly and annual Voltx plans for Starter, Professional, Business, and Enterprise teams.",
  "/pricing",
);

const faqs = [
  {
    question: "Is there a free trial?",
    answer:
      "Yes. Every paid plan includes a 14-day trial so your team can validate the platform before committing.",
  },
  {
    question: "How does AI usage factor into the plans?",
    answer:
      "Each plan includes a monthly AI request allowance. Higher plans include higher capacity, and Enterprise is scoped with your projected usage and rollout requirements.",
  },
  {
    question: "Can our team change plans later?",
    answer:
      "Talk to our team about changing plans or tailoring a rollout. We will confirm the right path for your organization before any commercial change is made.",
  },
  {
    question: "How does annual billing work?",
    answer:
      "Starter, Professional, and Business annual rates are displayed on the plan cards. Enterprise commercial terms are agreed directly with your team.",
  },
  {
    question: "What does the Enterprise plan include?",
    answer:
      "Enterprise provides unlimited platform usage, dedicated support, and commercial terms tailored to your security, deployment, and rollout requirements.",
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
