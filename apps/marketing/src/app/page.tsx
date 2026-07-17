import { BarChart3, Bot, Smartphone, Users, Workflow } from "lucide-react";
import { Hero } from "@/components/sections/hero";
import { TrustSection } from "@/components/sections/trust-section";
import { StatsBar } from "@/components/sections/stats-bar";
import { FeatureGrid } from "@/components/sections/feature-grid";
import { ProductTour } from "@/components/sections/product-tour";
import { FeatureShowcase } from "@/components/sections/feature-showcase";
import { DemoLibrary } from "@/components/sections/demo-library";
import { PricingSection } from "@/components/sections/pricing-section";
import { EnterpriseSection } from "@/components/sections/enterprise-section";
import { FaqSection } from "@/components/sections/faq-section";
import { CtaSection } from "@/components/sections/cta-section";
import { AiAutomationPreview } from "@/components/previews/ai-automation-preview";
import { AnalyticsPreview } from "@/components/previews/analytics-preview";
import { CrmPreview } from "@/components/previews/crm-preview";
import { MobileAppPreview } from "@/components/previews/mobile-app-preview";
import { WorkflowsPreview } from "@/components/previews/workflows-preview";
import { demoVideos } from "@/config/media";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TrustSection />
      <StatsBar />

      {/* Product overview */}
      <FeatureGrid />

      {/* Guided walkthrough of the core loop */}
      <ProductTour />

      {/* Feature deep-dives — each with live preview, steps, and demo-video slot */}
      <FeatureShowcase
        id="ai"
        icon={Bot}
        eyebrow="AI Automation"
        title="Agents that finish the work, not just the sentence"
        description="Voltx agents plan, call tools, and act inside your CRM, inbox, and workflows — with every step visible and every capability allow-listed."
        steps={[
          {
            title: "Ask in plain language",
            description: "“Follow up with Meridian Labs about the proposal” is a complete instruction.",
          },
          {
            title: "Watch the agent work",
            description:
              "It searches your CRM, reads meeting notes, and drafts the email — each tool call shown live.",
          },
          {
            title: "Approve and send",
            description:
              "You stay in the loop exactly where it matters; everything lands in the audit log.",
          },
        ]}
        preview={<AiAutomationPreview />}
        video={demoVideos.aiAutomation}
      />

      <FeatureShowcase
        id="crm"
        icon={Users}
        eyebrow="CRM"
        reverse
        title="A pipeline that moves itself forward"
        description="Companies, contacts, leads, and opportunities stay in sync with every conversation and agent action — no end-of-week data entry."
        steps={[
          {
            title: "Capture automatically",
            description: "Leads from forms, email, and integrations land enriched and deduplicated.",
          },
          {
            title: "Advance with context",
            description:
              "Activities, notes, and AI summaries follow the deal through every stage.",
          },
          {
            title: "Close with confidence",
            description: "Stage history and next steps are always current — for reps and for agents.",
          },
        ]}
        preview={<CrmPreview />}
        video={demoVideos.crm}
      />

      <FeatureShowcase
        id="workflows"
        icon={Workflow}
        eyebrow="Workflows"
        title="Automation with approvals built in"
        description="Compose triggers, AI steps, conditions, and human approvals on a visual canvas — then let it run with retries, audit trails, and full observability."
        steps={[
          {
            title: "Build visually",
            description: "Drag triggers, agents, conditions, and actions onto the canvas.",
          },
          {
            title: "Govern the risky steps",
            description: "Route high-stakes actions through approval steps with full context.",
          },
          {
            title: "Ship and observe",
            description: "Every run is traced step by step, with timings and outcomes.",
          },
        ]}
        preview={<WorkflowsPreview />}
        video={demoVideos.workflows}
      />

      <FeatureShowcase
        id="analytics"
        icon={BarChart3}
        eyebrow="Analytics"
        reverse
        title="Numbers that update themselves"
        description="Pipeline value, win rates, and cycle times refresh live as your team and your agents work — the dashboard is a consequence, not a chore."
        steps={[
          {
            title: "See the whole funnel",
            description: "Revenue, conversion, and velocity in one place, scoped to your org.",
          },
          {
            title: "Trust the trend",
            description: "Charts draw from the same records agents act on — one source of truth.",
          },
          {
            title: "Act on the outlier",
            description: "Spot the stalled deal and hand it to an agent from the same screen.",
          },
        ]}
        preview={<AnalyticsPreview />}
        video={demoVideos.analytics}
      />

      <FeatureShowcase
        id="mobile"
        icon={Smartphone}
        eyebrow="Mobile App"
        title="The whole platform, in your pocket"
        description="Native iOS and Android apps with the dashboard, CRM, AI conversations, and approvals — plus deep links, so a Slack ping opens the exact deal it's about."
        steps={[
          {
            title: "Stay notified",
            description: "Deal movements, approvals, and agent results arrive as push notifications.",
          },
          {
            title: "Act from anywhere",
            description: "Approve a workflow step or answer an agent from the train platform.",
          },
          {
            title: "Pick up where you left off",
            description: "Deep links land you on the exact record, on every platform.",
          },
        ]}
        preview={<MobileAppPreview />}
        video={demoVideos.mobileApp}
      />

      <DemoLibrary />
      <PricingSection />
      <EnterpriseSection />
      <FaqSection />
      <CtaSection />
    </>
  );
}
