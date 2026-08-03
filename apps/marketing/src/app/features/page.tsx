import { CalendarDays, Database, LockKeyhole, PlugZap, ShieldCheck, Webhook } from "lucide-react";
import { createPageMetadata } from "@/lib/metadata";
import { FeaturesHero } from "@/components/sections/features-hero";
import { FeatureShowcase } from "@/components/sections/feature-showcase";
import { AiTeamSection } from "@/components/sections/ai-team-section";
import { EnterpriseSection } from "@/components/sections/enterprise-section";
import { CtaSection } from "@/components/sections/cta-section";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { AiAutomationPreview } from "@/components/previews/ai-automation-preview";
import { CrmPreview } from "@/components/previews/crm-preview";
import { AnalyticsPreview } from "@/components/previews/analytics-preview";
import { WorkflowsPreview } from "@/components/previews/workflows-preview";
import { CommunicationsPreview } from "@/components/previews/communications-preview";
import { KnowledgePreview } from "@/components/previews/knowledge-preview";

export const metadata = createPageMetadata(
  "Features",
  "See how Voltx unifies executive intelligence, CRM, communications, automation, analytics, and knowledge in one AI Business Operating System.",
  "/features",
);

const integrations = [
  { label: "Google Workspace", icon: CalendarDays },
  { label: "Microsoft 365", icon: Database },
  { label: "Slack", icon: PlugZap },
  { label: "Stripe", icon: ShieldCheck },
  { label: "Zoom", icon: CalendarDays },
  { label: "Zapier", icon: PlugZap },
  { label: "REST API", icon: Database },
  { label: "Webhooks", icon: Webhook },
];

const fragmentedTools = ["CRM", "Email", "Automation", "Analytics", "Knowledge base", "AI tools"];

export default function FeaturesPage() {
  return (
    <div className="overflow-x-clip">
      <FeaturesHero />

      <FeatureShowcase
        id="chief-of-staff"
        icon={LockKeyhole}
        eyebrow="AI Chief of Staff"
        title="See the signal. Decide the next move."
        description="Your AI Chief of Staff monitors business health, surfaces risks and opportunities, and prepares the context behind each recommendation. You decide what moves forward."
        steps={[
          { title: "Start with the morning brief", description: "Revenue, pipeline, priorities, and operating risks arrive in one executive view." },
          { title: "Understand what changed", description: "Recommendations connect to the deals, conversations, and workflows that created the signal." },
          { title: "Keep control of every action", description: "Quick actions and approvals turn insight into accountable progress." },
        ]}
        preview={<AiAutomationPreview />}
        ctaHref="/book-demo"
        ctaLabel="See the executive view"
      />

      <FeatureShowcase
        id="crm"
        icon={Database}
        eyebrow="CRM"
        reverse
        title="A CRM that turns every interaction into momentum."
        description="Companies, contacts, leads, opportunities, activities, and timelines live together. AI brings the next best action forward so your team can spend less time maintaining records and more time building relationships."
        steps={[
          { title: "See every relationship in context", description: "Customer history, activity, ownership, and opportunity status stay connected." },
          { title: "Move opportunities with confidence", description: "Pipeline views show where attention is needed before revenue stalls." },
          { title: "Let AI handle the preparation", description: "Bring the right account context into follow-ups, qualification, and deal reviews." },
        ]}
        preview={<CrmPreview />}
        ctaHref="/book-demo"
        ctaLabel="Explore CRM"
      />

      <FeatureShowcase
        id="communications"
        icon={PlugZap}
        eyebrow="Communications"
        title="Every customer conversation, one searchable story."
        description="Email, SMS, WhatsApp, and conversations stay in a unified inbox with the customer history and AI assistance needed to respond clearly and consistently."
        steps={[
          { title: "Work from one inbox", description: "See conversations across channels without rebuilding customer context." },
          { title: "Get a useful reply, not an empty suggestion", description: "AI drafts use the thread and connected business history as their working context." },
          { title: "Keep the thread tied to the record", description: "Conversation summaries and follow-ups become part of the operating system." },
        ]}
        preview={<CommunicationsPreview />}
        ctaHref="/book-demo"
        ctaLabel="Explore communications"
      />

      <FeatureShowcase
        id="automation"
        icon={Webhook}
        eyebrow="Workflow automation"
        reverse
        title="Automate repetitive work without giving up governance."
        description="Build with visual triggers, conditions, AI actions, notifications, schedules, and approvals. Every run leaves an execution history so automation stays explainable."
        steps={[
          { title: "Build the flow visually", description: "Compose triggers, conditions, actions, and AI steps into a clear operating process." },
          { title: "Route sensitive decisions to people", description: "Approvals keep high-impact actions in the right hands." },
          { title: "Inspect every outcome", description: "Execution history and audit trails make exceptions visible instead of mysterious." },
        ]}
        preview={<WorkflowsPreview />}
        ctaHref="/book-demo"
        ctaLabel="Explore automation"
      />

      <FeatureShowcase
        id="analytics"
        icon={ShieldCheck}
        eyebrow="Executive analytics"
        title="Understand performance at a glance, with context behind every metric."
        description="Revenue, pipeline, business health, forecasts, and performance trends share the same operational data your teams act on. No hand-built reporting layer required."
        steps={[
          { title: "Read the business in seconds", description: "Executive KPIs bring the current operating picture into focus." },
          { title: "Follow the trend to its cause", description: "Metrics connect back to the opportunities, activity, and workflow signals underneath." },
          { title: "Use insight to prioritize", description: "AI helps identify the most meaningful next action without treating the metric as a black box." },
        ]}
        preview={<AnalyticsPreview />}
        ctaHref="/book-demo"
        ctaLabel="Explore analytics"
      />

      <FeatureShowcase
        id="knowledge"
        icon={Database}
        eyebrow="Knowledge hub"
        reverse
        title="Make company knowledge available when work is happening."
        description="Bring policies, documents, customer context, and internal expertise into a searchable knowledge hub. Semantic search and grounded AI answers help teams find and use the right information."
        steps={[
          { title: "Connect the knowledge your business already has", description: "Documents, policies, records, and conversation context become discoverable." },
          { title: "Search by meaning, not only keywords", description: "Find relevant information even when the question and source use different language." },
          { title: "Answer with sources in view", description: "AI responses can stay grounded in the records your team can inspect." },
        ]}
        preview={<KnowledgePreview />}
        ctaHref="/book-demo"
        ctaLabel="Explore knowledge"
      />

      <AiTeamSection />
      <EnterpriseSection />

      <section className="relative overflow-hidden py-24 sm:py-32">
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_40%,hsl(var(--primary)/0.12),transparent_24rem)]" />
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Integrations</SectionEyebrow>
            <Reveal delay={0.05}><h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">Connect Voltx to the tools your business already uses.</h2></Reveal>
            <Reveal delay={0.1}><p className="text-pretty mt-5 text-lg text-muted-foreground">Bring calendars, communications, payments, and external systems into the operating layer your team works from.</p></Reveal>
          </div>
          <StaggerGroup className="mx-auto mt-14 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
            {integrations.map((integration) => <StaggerItem key={integration.label}><div className="group flex min-h-28 flex-col justify-between rounded-xl border border-white/10 bg-card/50 p-4 transition-colors hover:border-primary/35 hover:bg-primary/[0.04]"><integration.icon className="h-5 w-5 text-primary" /><span className="text-sm font-medium text-white/85">{integration.label}</span></div></StaggerItem>)}
          </StaggerGroup>
        </div>
      </section>

      <section className="border-y border-border/70 bg-secondary/20 py-24 sm:py-32">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Why Voltx</SectionEyebrow>
            <Reveal delay={0.05}><h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">One operating system beats a pile of disconnected products.</h2></Reveal>
          </div>
          <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-[1fr_auto_1fr]">
            <Reveal><div className="h-full rounded-xl border border-white/10 bg-card/50 p-6 sm:p-8"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Traditional software</p><h3 className="mt-3 text-2xl font-medium">A handoff between tools.</h3><div className="mt-7 grid grid-cols-2 gap-2">{fragmentedTools.map((tool) => <span key={tool} className="rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/55">{tool}</span>)}</div><p className="mt-7 text-sm leading-relaxed text-muted-foreground">Context fragments, reporting trails behind, and your team spends time keeping systems aligned.</p></div></Reveal>
            <div className="hidden items-center justify-center lg:flex"><span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">→</span></div>
            <Reveal delay={0.1}><div className="h-full rounded-xl border border-primary/30 bg-primary/[0.07] p-6 shadow-[0_0_60px_-24px_hsl(var(--primary)/0.5)] sm:p-8"><p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Voltx</p><h3 className="mt-3 text-2xl font-medium">One AI Business Operating System.</h3><div className="mt-7 space-y-3">{["Shared customer and operating context", "AI that can prepare work across functions", "Governed automation with approvals and audit trails", "Executive intelligence that points to the next action"].map((benefit) => <div key={benefit} className="flex items-start gap-2 text-sm leading-relaxed text-white/75"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{benefit}</div>)}</div><p className="mt-7 text-sm leading-relaxed text-white/65">Less coordination overhead. Better decisions. A business that can operate as one system.</p></div></Reveal>
          </div>
        </div>
      </section>

      <CtaSection title="Ready to Run Your Business with AI?" description="Bring your CRM, communications, automation, analytics, and executive intelligence into one operating system." />
    </div>
  );
}