import { Hero } from "@/components/sections/hero";
import { StatsBar } from "@/components/sections/stats-bar";
import { FeatureGrid } from "@/components/sections/feature-grid";
import { WorkflowShowcase } from "@/components/sections/workflow-showcase";
import { CtaSection } from "@/components/sections/cta-section";

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBar />
      <FeatureGrid />
      <WorkflowShowcase />
      <CtaSection />
    </>
  );
}
