import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { FeatureWalkthrough } from "@/components/video/feature-walkthrough";
import { AiAutomationPreview } from "@/components/previews/ai-automation-preview";
import { AnalyticsPreview } from "@/components/previews/analytics-preview";
import { CrmPreview } from "@/components/previews/crm-preview";
import { WorkflowsPreview } from "@/components/previews/workflows-preview";

/**
 * The guided product tour: one pass through the core loop — capture,
 * automate, act, measure — with each step backed by the matching live
 * preview. Sits right under the hero so "show, don't tell" starts on
 * the first scroll.
 */
export function ProductTour() {
  return (
    <section id="tour" className="relative scroll-mt-24 overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-[15%] top-[30%] h-[24rem] w-[36rem] rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow>Product walkthrough</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              One platform, one loop:
              <br />
              <span className="gradient-text">capture, automate, act, measure</span>
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mt-5 text-lg leading-relaxed text-muted-foreground">
              Watch how a single lead moves through Voltx — from first touch to closed
              revenue — with AI doing the busywork at every step.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="mt-14 sm:mt-16">
          <FeatureWalkthrough
            steps={[
              {
                title: "Capture everything in the CRM",
                description:
                  "Companies, contacts, and deals stay in sync with every conversation — no manual entry.",
                visual: <CrmPreview />,
              },
              {
                title: "Let agents do the busywork",
                description:
                  "AI agents qualify, enrich, and draft follow-ups using your real business context.",
                visual: <AiAutomationPreview />,
              },
              {
                title: "Automate the handoffs",
                description:
                  "Visual workflows route approvals, notifications, and next steps — governed and audited.",
                visual: <WorkflowsPreview />,
              },
              {
                title: "Measure what matters",
                description:
                  "Pipeline, win rates, and cycle times update live as agents and reps work.",
                visual: <AnalyticsPreview />,
              },
            ]}
          />
        </Reveal>
      </div>
    </section>
  );
}
