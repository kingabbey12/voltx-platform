import type { Metadata } from "next";
import { LegalLayout } from "@/components/layout/legal-layout";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms that govern your use of ${siteConfig.name}.`,
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="July 7, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of Voltx,
        Inc.&apos;s (&quot;Voltx,&quot; &quot;we,&quot; &quot;us&quot;) website, applications,
        and services (the &quot;Service&quot;). By creating an account or using the Service,
        you agree to be bound by these Terms. If you are using the Service on behalf of an
        organization, you represent that you have authority to bind that organization.
      </p>

      <h2>1. The Service</h2>
      <p>
        Voltx provides an AI-native business operating platform, including CRM, AI agents,
        workflow automation, knowledge management, and related features (the
        &quot;Service&quot;). We may add, modify, or discontinue features at our discretion,
        with reasonable notice for material changes affecting paid functionality.
      </p>

      <h2>2. Accounts and registration</h2>
      <p>
        You must provide accurate and complete information when creating an account and are
        responsible for maintaining the confidentiality of your credentials. You are
        responsible for all activity under your account. Notify us immediately at{" "}
        <a href={`mailto:${siteConfig.email.support}`}>{siteConfig.email.support}</a> if you
        suspect unauthorized access.
      </p>

      <h2>3. Subscription plans and payment</h2>
      <p>
        Paid plans are billed in advance on a monthly or annual basis as selected at
        checkout. Fees are non-refundable except as required by law or expressly stated in
        these Terms. We may change pricing with at least 30 days&apos; notice; changes apply
        at your next renewal.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to use the Service to:</p>
      <ul>
        <li>Violate any applicable law or regulation</li>
        <li>Infringe the intellectual property or privacy rights of others</li>
        <li>Transmit malware, spam, or other harmful or unauthorized content</li>
        <li>
          Attempt to gain unauthorized access to the Service, other accounts, or underlying
          infrastructure
        </li>
        <li>
          Use automated means to extract data from the Service beyond what is provided via our
          documented API
        </li>
        <li>
          Reverse engineer or attempt to derive the source code of the Service, except as
          permitted by law
        </li>
      </ul>

      <h2>5. Customer data and ownership</h2>
      <p>
        As between you and Voltx, you retain all rights to the data you submit to the Service
        (&quot;Customer Data&quot;). You grant Voltx a limited license to host, process, and
        transmit Customer Data solely as necessary to provide the Service to you. Upon
        termination, you may export your Customer Data for 30 days before it is deleted in
        accordance with our data retention practices.
      </p>

      <h2>6. AI features and output</h2>
      <p>
        The Service includes AI-generated content, summaries, and autonomous agent actions.
        AI output is provided &quot;as-is&quot; and may contain inaccuracies. You are
        responsible for reviewing AI-generated output before relying on it for decisions with
        legal, financial, or employment consequences. Actions with external side effects are
        gated behind explicit approval steps within the Service.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        Voltx retains all rights, title, and interest in the Service, including its
        underlying software, design, and trademarks. These Terms do not grant you any rights
        to Voltx&apos;s intellectual property except the limited right to use the Service as
        permitted herein.
      </p>

      <h2>8. Service availability</h2>
      <p>
        We target a 99.9% uptime commitment for paid plans, excluding scheduled maintenance
        communicated in advance. Enterprise agreements may include service credits for missed
        availability targets as set out in the applicable order form.
      </p>

      <h2>9. Termination</h2>
      <p>
        You may cancel your subscription at any time; cancellation takes effect at the end of
        the current billing period. We may suspend or terminate your access if you materially
        breach these Terms and fail to cure the breach within a reasonable period after
        notice, or immediately in cases of severe or repeated violations.
      </p>

      <h2>10. Disclaimer of warranties</h2>
      <p>
        THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, WHETHER
        EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, OR NON-INFRINGEMENT, EXCEPT AS EXPRESSLY STATED IN AN APPLICABLE ORDER FORM.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, VOLTX SHALL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR
        REVENUE, ARISING FROM YOUR USE OF THE SERVICE. VOLTX&apos;S TOTAL LIABILITY FOR ANY
        CLAIM ARISING FROM THESE TERMS SHALL NOT EXCEED THE FEES PAID BY YOU IN THE 12 MONTHS
        PRECEDING THE CLAIM.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold Voltx harmless from any claims, damages, or expenses
        arising from your use of the Service in violation of these Terms or applicable law.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of the State of Delaware, without regard to its
        conflict of law principles, unless otherwise specified in an applicable enterprise
        agreement.
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will provide notice of material
        changes via email or an in-product notice at least 14 days before they take effect.
        Continued use of the Service after changes take effect constitutes acceptance.
      </p>

      <h2>15. Contact us</h2>
      <p>
        Questions about these Terms can be sent to{" "}
        <a href={`mailto:${siteConfig.email.support}`}>{siteConfig.email.support}</a>.
      </p>
    </LegalLayout>
  );
}
