import type { Metadata } from "next";
import { FaqSection, faqs } from "@/components/sections/faq-section";
import { CtaSection } from "@/components/sections/cta-section";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Voltx — how it differs from bolt-on AI, rollout time, model providers, data ownership, SSO and pricing.",
  alternates: { canonical: `${siteConfig.url}/faq` },
  openGraph: {
    title: "Frequently Asked Questions — Voltx",
    description: "How Voltx works, what it costs, and how your data is handled.",
    url: `${siteConfig.url}/faq`,
  },
};

// FAQPage structured data makes these eligible for rich results in search,
// which is most of the SEO value of having a dedicated FAQ page at all.
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <FaqSection as="h1" />
      <CtaSection />
    </>
  );
}
