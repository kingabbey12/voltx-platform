import { Hero } from "@/components/sections/hero";
import { TrustSection } from "@/components/sections/trust-section";
import { StatsBar } from "@/components/sections/stats-bar";
import { FeatureGrid } from "@/components/sections/feature-grid";
import { WorkflowShowcase } from "@/components/sections/workflow-showcase";
import { FaqSection } from "@/components/sections/faq-section";
import { CtaSection } from "@/components/sections/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustSection />
      <StatsBar />
      <FeatureGrid />
      <WorkflowShowcase />
      {/* A subset only — the full list lives on /faq, which also carries the
          FAQPage structured data so the rich result points there. */}
      <FaqSection limit={5} showViewAll />
      <CtaSection />
    </>
  );
}
