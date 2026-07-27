import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * Canonical FAQ content. Shared by the homepage summary and the full /faq
 * page so the two can never answer the same question differently.
 */
export const faqs: FaqItem[] = [
  {
    question: "What exactly is Voltx?",
    answer:
      "One platform covering the work that usually needs five or six: CRM, workflow automation, a knowledge base, meetings and communications, and AI agents that act across all of it. Because it is one system, an agent can read a deal, search your knowledge base and trigger a workflow without integrations in between.",
  },
  {
    question: "How is this different from bolting AI onto our existing tools?",
    answer:
      "Bolt-on AI can only see the tool it lives in. Voltx agents operate on shared data with shared permissions, so an agent can move between CRM, documents and workflows in a single run — and every action it takes is recorded against the same audit trail.",
  },
  {
    question: "How long does it take to get running?",
    answer:
      "Most teams have their first workflow live the same day. A full rollout — data imported, permissions modelled, agents tuned to your processes — usually takes two to four weeks depending on how many systems you are replacing.",
  },
  {
    question: "Can we bring our own AI provider?",
    answer:
      "Yes. Voltx is provider-agnostic and supports Anthropic, OpenAI and Google models. You can supply your own API keys, route different workloads to different models, and change provider without rewriting your agents or workflows.",
  },
  {
    question: "Is our data used to train models?",
    answer:
      "No. Your data is never used to train foundation models, and is never shared between tenants. Every query is scoped to your organization at the database layer, independently of application logic.",
  },
  {
    question: "What happens to our data if we leave?",
    answer:
      "You can export everything — records, documents, workflow definitions and audit history — in open formats at any time. There is no lock-in period and no export fee.",
  },
  {
    question: "Do you support SSO and provisioning?",
    answer:
      "Yes. SAML and OIDC single sign-on, SCIM user provisioning and deprovisioning, and role-based access control with per-organization permissions are included on enterprise plans.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Per-seat pricing with usage-based AI credits, so you are not charged for capacity you do not use. Plans and current limits are on the pricing page, and enterprise agreements are available with custom terms.",
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

interface FaqSectionProps {
  /** Show a subset — used on the homepage, where the full list is too long. */
  limit?: number;
  /** Link through to the full page. Off on /faq itself. */
  showViewAll?: boolean;
  /**
   * h2 when this is one section among many (the homepage); h1 on /faq, where
   * it is the page's subject and the document would otherwise have no h1.
   */
  as?: "h1" | "h2";
}

export function FaqSection({ limit, showViewAll = false, as = "h2" }: FaqSectionProps) {
  const items = limit ? faqs.slice(0, limit) : faqs;
  const Heading = as;

  return (
    <section className="relative py-20 sm:py-28" aria-labelledby="faq-heading">
      <div className="container">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <Heading
              id="faq-heading"
              className="text-balance mt-5 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.75rem]"
            >
              Questions, answered plainly
            </Heading>
            <p className="text-pretty mt-4 text-base leading-relaxed text-muted-foreground">
              If something isn&apos;t covered here,{" "}
              <Link
                href="/contact"
                className="text-primary underline-offset-4 hover:underline"
              >
                ask us directly
              </Link>
              .
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mx-auto mt-12 max-w-3xl">
            <Accordion type="single" collapsible className="w-full">
              {items.map((faq, index) => (
                <AccordionItem key={faq.question} value={`faq-${index}`}>
                  <AccordionTrigger>{faq.question}</AccordionTrigger>
                  <AccordionContent>{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {showViewAll && (
              <p className="mt-8 text-center text-sm text-muted-foreground">
                <Link
                  href="/faq"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  See all frequently asked questions
                </Link>
              </p>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
