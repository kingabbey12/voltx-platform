import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What exactly is Voltx?",
    answer:
      "Voltx is an AI business operating system: CRM, AI agents, workflows, knowledge, and analytics in one multi-tenant platform, with a web app, mobile app, and developer platform (APIs, SDKs, and an extension framework) on top.",
  },
  {
    question: "Do I need to replace my existing tools to start?",
    answer:
      "No. Most teams start with one workflow — usually lead follow-up or meeting notes into the CRM — and expand from there. Integrations for email, Slack, Teams, and WhatsApp connect Voltx to where work already happens.",
  },
  {
    question: "How do AI agents access my data, and what can they actually do?",
    answer:
      "Each agent has an explicit allow-list of tools it may call, runs inside your organization's tenant boundary, and sensitive actions can require human approval via workflow steps. Every agent action is recorded in the audit log.",
  },
  {
    question: "Which AI models does Voltx use?",
    answer:
      "Voltx is provider-agnostic: Anthropic, OpenAI, and Google models are supported behind one runtime, selectable per use case. You're never locked into a single model vendor.",
  },
  {
    question: "Is there a mobile app?",
    answer:
      "Yes — a native Flutter app for iOS and Android with the dashboard, CRM, AI conversations, notifications, and approvals, plus deep links so links from email or Slack open directly in the right screen.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Per-seat, with a free Starter plan (up to 10 seats and one AI agent), and paid tiers adding more agents, workflows, and enterprise controls. Annual billing saves 20%. See the pricing section above for details.",
  },
  {
    question: "Can we self-serve enterprise requirements like SSO and audit exports?",
    answer:
      "Yes. SAML/OIDC SSO, SCIM provisioning, custom roles, hash-chained audit logs with verified exports, and the GDPR toolkit (export, erasure, legal holds) are all product features you operate directly — not professional-services engagements.",
  },
  {
    question: "Can developers extend Voltx?",
    answer:
      "Yes — a public REST API with personal access tokens, official TypeScript, Python, and Flutter SDKs, a CLI, webhooks, and a declarative extension framework distributed through the marketplace.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="relative scroll-mt-24 py-24 sm:py-32">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <SectionEyebrow>FAQ</SectionEyebrow>
          <Reveal delay={0.05}>
            <h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
              Questions, answered
            </h2>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mx-auto mt-12 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq) => (
              <AccordionItem key={faq.question} value={faq.question}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
