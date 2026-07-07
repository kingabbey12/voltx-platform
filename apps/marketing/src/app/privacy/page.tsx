import type { Metadata } from "next";
import { LegalLayout } from "@/components/layout/legal-layout";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects your data.`,
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 7, 2026">
      <p>
        This Privacy Policy explains how Voltx, Inc. (&quot;Voltx,&quot; &quot;we,&quot;
        &quot;us,&quot; or &quot;our&quot;) collects, uses, discloses, and safeguards
        information when you use our website, applications, and services (collectively, the
        &quot;Service&quot;). By using the Service, you agree to the collection and use of
        information in accordance with this policy.
      </p>

      <h2>1. Information we collect</h2>
      <h3>1.1 Account information</h3>
      <p>
        When you create a Voltx account, we collect information such as your name, email
        address, company name, job title, and password (stored as a salted hash, never in
        plain text).
      </p>
      <h3>1.2 Customer data</h3>
      <p>
        In the course of using the Service, you and your organization may input business data
        such as CRM records, documents, messages, and workflow configurations
        (&quot;Customer Data&quot;). Customer Data is owned by you and is processed by Voltx
        solely to provide the Service.
      </p>
      <h3>1.3 Usage and device data</h3>
      <p>
        We automatically collect information about how you interact with the Service,
        including IP address, browser type, device identifiers, pages viewed, and timestamps,
        for security, analytics, and product improvement purposes.
      </p>

      <h2>2. How we use information</h2>
      <ul>
        <li>To provide, operate, and maintain the Service</li>
        <li>To authenticate users and secure accounts</li>
        <li>To power AI features such as agents, workflows, and knowledge search</li>
        <li>To communicate with you about updates, security notices, and support</li>
        <li>To monitor usage, detect abuse, and improve reliability and performance</li>
        <li>To comply with legal obligations</li>
      </ul>

      <h2>3. AI processing and your data</h2>
      <p>
        Voltx uses artificial intelligence, including large language models operated by
        third-party providers, to power agents, chat, knowledge search, and workflow
        automation. Customer Data used as context for AI features is processed under the same
        tenant-isolation guarantees as the rest of the Service:
      </p>
      <ul>
        <li>
          Your data is never used to train models for the benefit of other customers or the
          general public.
        </li>
        <li>
          Data sent to AI providers is not retained by those providers beyond the individual
          request, consistent with our provider agreements.
        </li>
        <li>
          Every AI-originated action is logged with model, provider, and token usage for
          auditability.
        </li>
      </ul>

      <h2>4. How we share information</h2>
      <p>We do not sell your personal information. We may share information with:</p>
      <ul>
        <li>
          <strong>Subprocessors</strong> — vetted infrastructure, AI, and email providers who
          process data on our behalf under contractual confidentiality and security
          obligations.
        </li>
        <li>
          <strong>Legal compliance</strong> — where required to comply with applicable law,
          regulation, legal process, or governmental request.
        </li>
        <li>
          <strong>Business transfers</strong> — in connection with a merger, acquisition, or
          sale of assets, subject to standard confidentiality protections.
        </li>
      </ul>

      <h2>5. Data security</h2>
      <p>
        We employ industry-standard safeguards, including encryption in transit (TLS 1.2+) and
        at rest (AES-256), role-based access controls, and tenant isolation enforced at the
        database layer. No method of transmission or storage is 100% secure, and we cannot
        guarantee absolute security.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We retain account information and Customer Data for as long as your account is active
        or as needed to provide the Service. You may request deletion of your data at any time,
        subject to legal retention requirements. Data is deleted or anonymized within 30 days
        of a verified deletion request.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Depending on your location, you may have rights to access, correct, export, or delete
        your personal information, and to object to or restrict certain processing. To
        exercise these rights, contact us at{" "}
        <a href={`mailto:${siteConfig.email.support}`}>{siteConfig.email.support}</a>.
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use essential cookies to operate the Service (such as session authentication) and
        limited analytics cookies to understand product usage. You can control cookies through
        your browser settings; disabling essential cookies may affect Service functionality.
      </p>

      <h2>9. International data transfers</h2>
      <p>
        Voltx may process and store information in countries other than your own. Where
        required, we rely on appropriate safeguards, such as standard contractual clauses, to
        protect data transferred internationally.
      </p>

      <h2>10. Children&apos;s privacy</h2>
      <p>
        The Service is not directed to individuals under 16. We do not knowingly collect
        personal information from children. If we become aware of such collection, we will
        take steps to delete the information.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material
        changes via email or an in-product notice prior to the change taking effect.
      </p>

      <h2>12. Contact us</h2>
      <p>
        If you have questions about this Privacy Policy, contact us at{" "}
        <a href={`mailto:${siteConfig.email.support}`}>{siteConfig.email.support}</a>.
      </p>
    </LegalLayout>
  );
}
