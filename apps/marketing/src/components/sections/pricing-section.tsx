import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { PricingTable } from "@/components/sections/pricing-table";

/** Homepage pricing: the same live PricingTable the /pricing page uses,
 * so the two can never drift apart. */
export function PricingSection() {
  return (
    <section id="pricing" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow>Pricing</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              Start free. Scale when it works.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mt-5 text-lg leading-relaxed text-muted-foreground">
              Simple per-seat pricing, a free-forever Starter plan, and 20% off annual
              billing. Full details on the{" "}
              <a href="/pricing" className="text-primary underline-offset-4 hover:underline">
                pricing page
              </a>
              .
            </p>
          </Reveal>
        </div>

        <div className="mt-14">
          <PricingTable />
        </div>
      </div>
    </section>
  );
}
