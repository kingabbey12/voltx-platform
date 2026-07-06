/**
 * VT-033 — Public beta demo data (realistic enterprise content).
 *
 * Replaces VT-032's bulk lorem-ipsum seed with a smaller, curated, named
 * dataset: real-sounding enterprise accounts, real written knowledge-base
 * documents (actually indexed with real embeddings so semantic search
 * returns meaningful results), and named agents/workflows matching a
 * realistic company's actual use of Voltx. Wipes and reseeds the demo
 * organization's CRM/AI/knowledge data on every run (org/user themselves
 * are reused, not recreated).
 *
 * Run against a running backend + Postgres, with a working AI provider key
 * configured (real indexing needs real embeddings):
 *
 *   cd backend && npx ts-node --transpile-only scripts/seed-demo-data.ts
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

const API_BASE_URL = process.env.SEED_API_BASE_URL ?? 'http://localhost:3000/api/v1';
const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo.owner@voltx.io';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'DemoBeta2026!';

async function bootstrapOrganization(): Promise<{
  organizationId: string;
  userId: string;
  accessToken: string;
}> {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (existing) {
    const membership = await prisma.membership.findFirstOrThrow({
      where: { userId: existing.id, status: 'ACTIVE' },
    });
    const login = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    const loginBody = (await login.json()) as { data: { accessToken: string } };
    console.log(`Reusing existing demo organization ${membership.organizationId}`);
    return {
      organizationId: membership.organizationId,
      userId: existing.id,
      accessToken: loginBody.data.accessToken,
    };
  }

  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      firstName: 'Demo',
      lastName: 'Owner',
      organizationName: 'Voltx Demo',
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to register demo org owner: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as {
    data: { user: { id: string }; accessToken: string };
  };
  const membership = await prisma.membership.findFirstOrThrow({
    where: { userId: body.data.user.id },
  });
  console.log(`Created demo organization ${membership.organizationId}, owner ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  return {
    organizationId: membership.organizationId,
    userId: body.data.user.id,
    accessToken: body.data.accessToken,
  };
}

async function wipeExistingDemoData(organizationId: string): Promise<void> {
  console.log('Wiping existing demo CRM/AI/knowledge data...');
  const db = prisma;
  await db.knowledgeRelationship.deleteMany({ where: { organizationId } });
  await db.knowledgeEntity.deleteMany({ where: { organizationId } });
  await db.knowledgeChunk.deleteMany({ where: { document: { organizationId } } });
  await db.knowledgeDocument.deleteMany({ where: { organizationId } });
  await db.knowledgeSource.deleteMany({ where: { organizationId } });
  await db.workflowRun.deleteMany({ where: { organizationId } });
  await db.workflowVersion.deleteMany({ where: { organizationId } });
  await db.workflow.deleteMany({ where: { organizationId } });
  await db.agentRun.deleteMany({ where: { agent: { organizationId } } });
  await db.agent.deleteMany({ where: { organizationId } });
  await db.salesActivity.deleteMany({ where: { organizationId } });
  await db.salesOpportunity.deleteMany({ where: { organizationId } });
  await db.salesLead.deleteMany({ where: { organizationId } });
  await db.salesContact.deleteMany({ where: { organizationId } });
  await db.salesCompany.deleteMany({ where: { organizationId } });
  await db.integrationConnection.deleteMany({ where: { organizationId } });
  await db.message.deleteMany({ where: { conversation: { organizationId } } });
  await db.conversation.deleteMany({ where: { organizationId } });
  console.log('Wipe complete.');
}

interface CompanySeed {
  name: string;
  domain: string;
  industry: string;
  location: string;
  employeeCount: number;
  arr: number;
  healthScore: number;
  status: 'PROSPECT' | 'ACTIVE' | 'INACTIVE';
}

// ARR/healthScore below are Voltx's own CRM figures for these accounts
// (contract value with Voltx and Voltx's internal customer-health score) —
// not a claim about the real companies' own public financials. Employee
// count and headquarters location are the real companies' well-known
// public scale/location, used only for realistic account context.
const COMPANIES: CompanySeed[] = [
  { name: 'Tesla', domain: 'tesla.com', industry: 'Automotive & Energy', location: 'Austin, TX', employeeCount: 140000, arr: 480000, healthScore: 82, status: 'ACTIVE' },
  { name: 'Stripe', domain: 'stripe.com', industry: 'Financial Technology', location: 'San Francisco, CA', employeeCount: 8000, arr: 620000, healthScore: 91, status: 'ACTIVE' },
  { name: 'OpenAI', domain: 'openai.com', industry: 'Artificial Intelligence', location: 'San Francisco, CA', employeeCount: 3500, arr: 750000, healthScore: 88, status: 'ACTIVE' },
  { name: 'Shopify', domain: 'shopify.com', industry: 'E-Commerce Platform', location: 'Ottawa, Canada', employeeCount: 12000, arr: 340000, healthScore: 76, status: 'ACTIVE' },
  { name: 'HubSpot', domain: 'hubspot.com', industry: 'Marketing & Sales Software', location: 'Cambridge, MA', employeeCount: 7500, arr: 290000, healthScore: 84, status: 'ACTIVE' },
  { name: 'NVIDIA', domain: 'nvidia.com', industry: 'Semiconductors & Computing', location: 'Santa Clara, CA', employeeCount: 29000, arr: 890000, healthScore: 95, status: 'ACTIVE' },
  { name: 'Atlassian', domain: 'atlassian.com', industry: 'Developer & Collaboration Tools', location: 'Sydney, Australia', employeeCount: 11000, arr: 210000, healthScore: 71, status: 'ACTIVE' },
  { name: 'Airbnb', domain: 'airbnb.com', industry: 'Travel & Hospitality', location: 'San Francisco, CA', employeeCount: 6800, arr: 175000, healthScore: 68, status: 'PROSPECT' },
  { name: 'Snowflake', domain: 'snowflake.com', industry: 'Cloud Data Platform', location: 'Bozeman, MT', employeeCount: 7600, arr: 410000, healthScore: 79, status: 'ACTIVE' },
  { name: 'Datadog', domain: 'datadoghq.com', industry: 'Observability & Monitoring', location: 'New York, NY', employeeCount: 5200, arr: 265000, healthScore: 74, status: 'PROSPECT' },
];

const CONTACT_ROLES = [
  { title: 'Chief Executive Officer', firstName: 'Marcus', lastName: 'Hale' },
  { title: 'Chief Technology Officer', firstName: 'Priya', lastName: 'Natarajan' },
  { title: 'VP of Sales', firstName: 'Renee', lastName: 'Beaumont' },
  { title: 'VP of Marketing', firstName: 'Jordan', lastName: 'Castellano' },
  { title: 'VP of Finance', firstName: 'Alicia', lastName: 'Whitfield' },
  { title: 'Head of Customer Support', firstName: 'Tomás', lastName: 'Reyes' },
];

const OPPORTUNITY_TEMPLATES = [
  { suffix: 'Enterprise AI Platform — Multi-Region Deployment', stage: 'NEGOTIATION', amountRange: [180000, 420000] },
  { suffix: 'Sales Copilot Expansion — Additional Seats', stage: 'PROPOSAL', amountRange: [40000, 95000] },
  { suffix: 'Knowledge Graph Add-On — Q3 Renewal Upsell', stage: 'DISCOVERY', amountRange: [25000, 60000] },
];

const ACTIVITY_TEMPLATES: {
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE';
  subject: string;
  description: string;
}[] = [
  { type: 'CALL', subject: 'Discovery call — current tooling and pain points', description: 'Walked through their existing stack, identified gaps in AI-assisted workflow automation and CRM data quality.' },
  { type: 'EMAIL', subject: 'Follow-up: pricing tiers and enterprise SSO requirements', description: 'Sent the enterprise pricing sheet and confirmed SSO/SCIM support is included at the Enterprise tier.' },
  { type: 'MEETING', subject: 'Executive alignment — Q3 renewal and expansion', description: 'Reviewed adoption metrics with their VP of Sales, agreed on a phased rollout to two additional business units.' },
  { type: 'TASK', subject: 'Prepare custom ROI analysis for CFO review', description: 'Build a cost-savings model comparing current manual workflow time vs. Voltx AI agent automation.' },
  { type: 'NOTE', subject: 'Security review requirements', description: 'Their security team requires SOC 2 Type II report and a signed DPA before proceeding past the pilot phase.' },
];

async function seedCompaniesAndCrm(
  organizationId: string,
): Promise<{ companyIds: Record<string, string>; contactIds: string[]; opportunityIds: string[] }> {
  const companyIds: Record<string, string> = {};
  const contactIds: string[] = [];
  const opportunityIds: string[] = [];

  for (const company of COMPANIES) {
    const companyId = randomUUID();
    companyIds[company.name] = companyId;
    await prisma.salesCompany.create({
      data: {
        id: companyId,
        organizationId,
        name: company.name,
        domain: company.domain,
        website: `https://www.${company.domain}`,
        industry: company.industry,
        status: company.status,
        notes: `Strategic ${company.status === 'ACTIVE' ? 'customer' : 'prospect'} account. ARR figures and health score below reflect Voltx's own contract with ${company.name}, not the company's public financials.`,
        metadata: {
          arr: company.arr,
          employeeCount: company.employeeCount,
          location: company.location,
          healthScore: company.healthScore,
        },
      },
    });

    const companyContactIds: string[] = [];
    for (const role of CONTACT_ROLES) {
      const contactId = randomUUID();
      companyContactIds.push(contactId);
      contactIds.push(contactId);
      const emailLocal = `${role.firstName}.${role.lastName}`.toLowerCase();
      await prisma.salesContact.create({
        data: {
          id: contactId,
          organizationId,
          companyId,
          firstName: role.firstName,
          lastName: role.lastName,
          email: `${emailLocal}@${company.domain}`,
          phone: '+1-555-0100',
          jobTitle: role.title,
          notes: `${role.title} at ${company.name}.`,
        },
      });
    }

    for (const template of OPPORTUNITY_TEMPLATES) {
      const opportunityId = randomUUID();
      opportunityIds.push(opportunityId);
      const [min, max] = template.amountRange;
      const amount = Math.round((min + Math.random() * (max - min)) / 1000) * 1000;
      const probability = { DISCOVERY: 15, QUALIFICATION: 30, PROPOSAL: 55, NEGOTIATION: 75 }[template.stage] ?? 20;
      await prisma.salesOpportunity.create({
        data: {
          id: opportunityId,
          organizationId,
          companyId,
          contactId: companyContactIds[2], // VP of Sales owns the commercial relationship
          title: `${company.name} — ${template.suffix}`,
          stage: template.stage as never,
          amount,
          currency: 'USD',
          probability,
          expectedCloseAt: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          insights: `${company.name} has ${company.employeeCount.toLocaleString()} employees across ${company.location} and beyond; current Voltx health score ${company.healthScore}/100.`,
          nextBestAction: 'Schedule executive business review to confirm budget approval timeline.',
          notes: `Sourced from ${company.status === 'ACTIVE' ? 'expansion motion within existing account' : 'outbound prospecting'}.`,
        },
      });
    }

    for (const activity of ACTIVITY_TEMPLATES) {
      await prisma.salesActivity.create({
        data: {
          id: randomUUID(),
          organizationId,
          companyId,
          contactId: companyContactIds[Math.floor(Math.random() * companyContactIds.length)],
          type: activity.type,
          subject: `${company.name}: ${activity.subject}`,
          description: activity.description,
          occurredAt: activity.type === 'TASK' ? null : new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          dueAt: activity.type === 'TASK' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
          completed: activity.type !== 'TASK',
          meetingSummary: activity.type === 'MEETING' ? activity.description : null,
        },
      });
    }

    console.log(`  seeded ${company.name}: 1 company, ${CONTACT_ROLES.length} contacts, ${OPPORTUNITY_TEMPLATES.length} opportunities, ${ACTIVITY_TEMPLATES.length} activities`);
  }

  return { companyIds, contactIds, opportunityIds };
}

interface KnowledgeDoc {
  title: string;
  content: string;
}

const KNOWLEDGE_DOCS: KnowledgeDoc[] = [
  {
    title: 'Sales Playbook',
    content: `Voltx Sales Playbook

Our ideal customer profile is a mid-market to enterprise company (500+ employees) running distributed sales, support, or operations teams who need AI-assisted workflow automation layered on top of their existing CRM data. The strongest signal for fit is a company already investing in CRM hygiene but struggling to turn that data into repeatable action.

Qualification follows a lightweight MEDDIC-style framework: confirm Metrics (what number are they trying to move — pipeline velocity, response time, ticket resolution), Economic Buyer (usually VP Sales, VP CS, or CFO for larger deals), Decision Criteria (security/compliance requirements come up in nearly every enterprise deal), Decision Process (map out procurement and security review steps early), Identify Pain (what manual process is costing them the most time), and Champion (someone internally who will advocate for Voltx between calls).

Standard deal stages are Discovery, Qualification, Proposal, Negotiation, and Closed Won/Lost. A deal should not move to Proposal until the economic buyer has been identified and a rough budget range confirmed. Discounting beyond 15% off list requires VP Sales approval; beyond 25% requires the Deal Approval workflow with Finance sign-off.

Common objections: "We already have a CRM" — reposition Voltx as the AI/automation layer on top of their existing CRM, not a replacement. "Our data isn't clean enough for AI" — the Knowledge Graph and retrieval layer are designed to work with imperfect data and improve incrementally. "Security review will take months" — proactively share the security policy and SOC 2 report at the start of the sales cycle, not after signature.`,
  },
  {
    title: 'Employee Handbook',
    content: `Voltx Employee Handbook

Welcome to Voltx. This handbook covers the policies every employee should know. Full-time employees accrue 20 days of PTO per year, plus 10 company holidays; PTO requests should be submitted through the HR system at least two weeks in advance where possible, with manager approval required for anything over five consecutive days.

Remote work is supported company-wide; there is no mandated in-office schedule, but teams are expected to maintain at least 4 hours of overlap with their team's core working hours for synchronous collaboration. Home office stipends of $500/year are available for equipment.

Code of conduct: treat colleagues, customers, and partners with respect regardless of role or seniority. Harassment, discrimination, or retaliation of any kind will not be tolerated and should be reported to HR or through the anonymous ethics hotline. Conflicts of interest (including outside employment, significant investments in competitors, or close personal relationships affecting reporting lines) must be disclosed to your manager.

Benefits include medical/dental/vision coverage starting day one, a 4% 401(k) match, and a annual learning and development budget of $1,500 per employee. New hires complete a two-week onboarding program covering company history, product architecture, security training, and a shadow period with their team before taking on independent work.`,
  },
  {
    title: 'Customer Success Guide',
    content: `Voltx Customer Success Guide

Every new customer is assigned a Customer Success Manager (CSM) within 24 hours of contract signature. The onboarding cadence is: kickoff call within 3 business days, technical setup and data integration within the first 2 weeks, first value milestone (first automated workflow live) by day 30, and a 90-day business review to quantify ROI.

Health score is calculated from four weighted signals: product usage frequency (35%), feature adoption breadth — are they using AI agents, workflows, and knowledge search, not just one (25%), support ticket sentiment and volume (20%), and executive engagement — attendance at QBRs and responsiveness to CSM outreach (20%). A score below 60 triggers an automatic escalation to the CSM's manager and a retention risk review.

Quarterly Business Reviews (QBRs) should cover: usage trends since the last review, ROI metrics tied to the customer's original success criteria, a roadmap preview relevant to their use cases, and an open discussion of expansion opportunities. QBR decks are due to the customer 48 hours in advance.

Escalation path for at-risk accounts: CSM flags the account in the CRM with a risk reason, the Support Escalation workflow notifies the CSM's manager and the account's assigned Solutions Engineer, and a joint recovery plan is created within 5 business days. Executive sponsors should be looped in for any account above $100K ARR showing sustained health score decline over two consecutive months.`,
  },
  {
    title: 'Security Policy',
    content: `Voltx Security Policy

Data classification: customer data is classified as Confidential by default. Personally identifiable information (PII) and authentication credentials are classified as Restricted and subject to additional encryption and access-logging requirements. Internal business documents (this handbook included) are classified as Internal Use Only.

Access control follows least-privilege and role-based access control (RBAC) principles. Production database access requires manager approval and is logged and reviewed quarterly. All employee accounts require multi-factor authentication; service accounts use short-lived credentials rotated automatically.

Encryption: data is encrypted in transit via TLS 1.2+ everywhere, and at rest using AES-256. Customer API keys and OAuth credentials for third-party integrations are encrypted at the application layer before storage, not just relying on disk-level encryption.

Vulnerability management: dependencies are scanned continuously; critical vulnerabilities must be patched within 48 hours, high severity within 7 days. Any suspected security incident — unauthorized access, data exposure, or a credible phishing report — must be reported immediately to the security team via the #security-incidents channel or security@voltx.io, which triggers the Incident Response process.

Third-party vendor risk: any vendor with access to customer data must complete a security questionnaire and, for vendors handling Restricted data, a signed Data Processing Agreement (DPA) before integration goes live.`,
  },
  {
    title: 'Incident Response',
    content: `Voltx Incident Response Runbook

Severity levels: SEV1 (complete outage or confirmed data breach, all-hands response, customer communication within 30 minutes), SEV2 (major feature degradation affecting many customers, response within 1 hour), SEV3 (minor issue affecting a subset of customers or an internal-only issue, response within 4 hours during business hours).

On-call rotation covers engineering, with a secondary on-call for the platform/infrastructure team. The on-call engineer is paged automatically via the monitoring system; acknowledgment is required within 5 minutes for SEV1/SEV2.

Incident process: (1) the on-call engineer declares the incident and assigns a severity, (2) an incident commander is designated for SEV1/SEV2 to coordinate response separately from the engineers actively debugging, (3) a status page update is posted for any customer-visible incident within 15 minutes, (4) updates are posted at least every 30 minutes until resolution for SEV1.

Postmortems are required for all SEV1 and SEV2 incidents, written within 3 business days, and are blameless — the focus is on systemic contributing factors and process gaps, not individual fault. Every postmortem must include a timeline, root cause, customer impact, and a list of follow-up action items with owners and due dates, tracked to completion.

Security incidents (suspected breach, unauthorized access, credential compromise) follow this same process but additionally loop in the security team and legal counsel immediately, and follow separate customer-notification obligations under applicable data protection regulations.`,
  },
  {
    title: 'Engineering Handbook',
    content: `Voltx Engineering Handbook

Architecture principles: services are organized by domain (auth, AI/agents, sales, knowledge, workflows, integrations), each owning its own data access layer. Cross-domain communication happens through well-defined service interfaces, not direct database access across domain boundaries. Multi-tenancy is enforced at two layers — middleware-derived tenant context and a database-extension layer that auto-scopes queries — treat any code path that bypasses both as a security bug, not a convenience.

Code review: every change requires at least one approving review before merge. Reviewers should focus on correctness, security implications (especially anything touching auth, tenant isolation, or data access), and test coverage — not bikeshedding on style, which is handled by automated linting. PRs should be scoped to a single logical change; large refactors should be split from behavioral changes where possible.

Testing requirements: new business logic requires unit test coverage; new API endpoints require at least one end-to-end test covering the happy path and the primary failure mode (auth rejection, validation failure, or not-found). Flaky tests are treated as bugs and quarantined, not ignored.

Deployment process: changes merge to main after CI passes (lint, unit tests, e2e tests, build). Deploys to staging are automatic; production deploys require a manual approval gate and run outside of customer business hours where the change carries migration risk. Database migrations are reviewed separately from application code changes given their higher blast radius, and must be backward-compatible with the previous application version to support zero-downtime rollout.`,
  },
  {
    title: 'AI Usage Policy',
    content: `Voltx AI Usage Policy

Acceptable use: Voltx's AI agents and workflow automation are intended to assist employees and customers with drafting, summarization, research, and routine task execution — not to make final decisions on matters with legal, financial, or employment consequences without human review. Any AI-generated output used in a customer-facing communication, contract, or financial approval must be reviewed by a human before being acted on.

Data privacy: customer data used as context for AI features (chat, knowledge search, agent runs) is processed under the same tenant-isolation guarantees as the rest of the platform — it is never used to train models for other customers, and is not retained by the underlying AI provider beyond the individual request per our provider agreements.

Human-in-the-loop requirements: autonomous agents may execute pre-approved tool actions (data lookups, drafting, scheduling) but any action with an external side effect outside the customer's own workspace — sending an email to a third party, modifying a financial record, or approving a deal discount — requires an explicit approval step, enforced through the Workflow Approval step type, not agent discretion alone.

Transparency: customers can see which AI agent or workflow produced any given output via message metadata (provider, model, agent name), and every AI-originated action is logged with token usage and cost for auditability. Employees should disclose AI involvement when it materially shaped a customer-facing deliverable (e.g., an AI-drafted contract summary), consistent with our commitment to not present AI output as unassisted human work.`,
  },
  {
    title: 'Pricing Guide',
    content: `Voltx Pricing Guide

Tiers: Starter (up to 10 seats, core CRM + single AI agent, self-serve), Growth (up to 50 seats, full AI workspace including multi-agent workflows and knowledge search, assigned CSM), and Enterprise (unlimited seats, SSO/SCIM, custom data retention, dedicated Solutions Engineer, and a named support SLA).

List pricing is per-seat per-month, billed annually, with volume discounts starting at 25 seats. Enterprise contracts are quoted individually based on projected AI usage volume (token consumption across chat, agents, and knowledge search) in addition to seat count, since AI compute is the primary variable cost driver.

Discount approval thresholds: sales reps may approve up to 10% off list without escalation. 10-15% requires sales manager approval. 15-25% requires VP Sales approval and must be logged with a business justification (competitive displacement, multi-year commitment, strategic logo). Anything beyond 25%, or any non-standard contract term (custom data residency, non-standard payment terms, liability cap changes), must go through the Deal Approval workflow, which routes to Finance and Legal automatically.

Enterprise contracts include a standard 99.9% uptime SLA with service credits for missed targets, and a right to a security audit once per contract year. Multi-year contracts (2-3 years) receive an additional 5-10% discount and price-lock protection against list price increases.`,
  },
  {
    title: 'Onboarding Guide',
    content: `Voltx Customer Onboarding Guide

Day 0 (contract signature): the deal is automatically routed through the Customer Onboarding workflow, which creates the customer's workspace, provisions the assigned CSM and Solutions Engineer, and schedules the kickoff call within 3 business days.

Kickoff call agenda: introductions and roles on both sides, review of the customer's original success criteria from the sales process, a walkthrough of the 30/60/90-day plan, and confirmation of technical prerequisites (SSO configuration if Enterprise tier, data sources to connect for knowledge search, initial AI agents to configure).

Weeks 1-2 (technical setup): connect CRM/data sources, configure SSO if applicable, set up the customer's first knowledge base, and configure at least one AI agent tailored to their primary use case (commonly Sales Copilot or Customer Support Agent). The Solutions Engineer validates data flow end-to-end before handing primary ownership to the CSM.

Day 30 (first value milestone): confirm the customer has run their first automated workflow successfully and can point to a concrete time-saved or response-time-improved metric. This is tracked as a required milestone — accounts that miss it are flagged for CSM leadership review.

Day 90 (business review): first formal QBR, reviewing adoption against the original success criteria, gathering product feedback, and identifying expansion opportunities (additional seats, additional AI agents, or upgrading tiers). Onboarding is considered complete once the day-90 review is delivered.`,
  },
  {
    title: 'Support SOP',
    content: `Voltx Support Standard Operating Procedure

Ticket triage: every incoming ticket is auto-classified by urgency and product area. P1 (customer-reported outage or data-integrity issue) requires first response within 30 minutes and is automatically escalated to on-call engineering if unresolved within 2 hours. P2 (significant feature degradation) requires first response within 4 business hours. P3 (general question or minor bug) requires first response within 1 business day.

SLA tiers by contract: Enterprise customers receive the response times above with 24/7 coverage for P1. Growth tier customers receive the same response times during business hours only. Starter tier is best-effort, community and documentation-first support with business-hours ticket coverage.

Escalation matrix: a support agent unable to resolve a ticket within the SLA window escalates to a Tier 2 specialist for that product area (AI/agents, workflows, integrations, or billing). Tier 2 escalates to engineering on-call for confirmed bugs, or to the customer's CSM for account-health or expectation-setting issues that aren't purely technical.

Common resolution playbooks: for "AI agent not responding" tickets, first check the organization's AI provider configuration and rate-limit status before assuming a product bug. For "workflow stuck in running" tickets, check the workflow run's current step and whether it's an approval step awaiting a human decision, which is expected behavior, not a bug. For "data missing from knowledge search" tickets, confirm the relevant knowledge source has completed indexing (status INDEXED, not PENDING) before escalating to engineering.

Every ticket resolution is logged with a root-cause tag so Support Escalation trends can be reviewed monthly and fed back into the product roadmap and this SOP.`,
  },
];

async function seedKnowledgeBase(organizationId: string, accessToken: string): Promise<void> {
  const sourceResponse = await fetch(`${API_BASE_URL}/knowledge/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      type: 'DOCUMENT',
      name: 'Company Handbook & Playbooks',
      description: 'Core internal documentation: sales, support, security, and engineering playbooks.',
    }),
  });
  if (!sourceResponse.ok) {
    throw new Error(`Failed to create knowledge source: ${sourceResponse.status} ${await sourceResponse.text()}`);
  }
  const sourceBody = (await sourceResponse.json()) as { data: { id: string } };
  const sourceId = sourceBody.data.id;

  for (const doc of KNOWLEDGE_DOCS) {
    const createResponse = await fetch(`${API_BASE_URL}/knowledge/sources/${sourceId}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        title: doc.title,
        contentType: 'text',
        text: doc.content,
      }),
    });
    if (!createResponse.ok) {
      throw new Error(`Failed to create document "${doc.title}": ${createResponse.status} ${await createResponse.text()}`);
    }
    console.log(`  created document: ${doc.title}`);
  }

  console.log('  indexing knowledge source (real embeddings)...');
  const reindexResponse = await fetch(`${API_BASE_URL}/knowledge/sources/${sourceId}/reindex`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!reindexResponse.ok) {
    throw new Error(`Failed to reindex: ${reindexResponse.status} ${await reindexResponse.text()}`);
  }
  const reindexBody = (await reindexResponse.json()) as {
    data: { documentId: string; status: string; chunkCount: number }[];
  };
  for (const result of reindexBody.data) {
    console.log(`    ${result.documentId}: ${result.status} (${result.chunkCount} chunks)`);
  }
}

const AGENT_DEFINITIONS = [
  { name: 'Executive Assistant', description: 'Manages scheduling, prioritization, and executive-level summaries across the business.', systemPrompt: 'You are the Executive Assistant agent for Voltx. Be concise, prioritize what matters, and surface the most decision-relevant information first.', toolNames: ['datetime', 'json'] },
  { name: 'Sales Copilot', description: 'Assists the sales team with account research, deal qualification, and pipeline analysis.', systemPrompt: 'You are the Sales Copilot for Voltx. Help reps qualify deals using MEDDIC, surface account context, and draft outreach.', toolNames: ['datetime', 'http_get', 'json'] },
  { name: 'Finance Analyst', description: 'Analyzes ARR, deal economics, and discount requests against pricing policy.', systemPrompt: 'You are the Finance Analyst agent for Voltx. Ground every answer in the Pricing Guide and flag any discount request above policy thresholds.', toolNames: ['json'] },
  { name: 'Marketing Strategist', description: 'Supports campaign planning and messaging aligned to ICP and positioning.', systemPrompt: 'You are the Marketing Strategist agent for Voltx. Keep messaging aligned to the ideal customer profile defined in the Sales Playbook.', toolNames: ['datetime', 'json'] },
  { name: 'Customer Support Agent', description: 'Triages support tickets and drafts resolutions following the Support SOP.', systemPrompt: 'You are the Customer Support Agent for Voltx. Follow the Support SOP escalation matrix and SLA tiers exactly.', toolNames: ['datetime', 'json'] },
  { name: 'Operations Manager', description: 'Oversees workflow health, incident response, and operational reporting.', systemPrompt: 'You are the Operations Manager agent for Voltx. Reference the Incident Response runbook for any operational issue.', toolNames: ['datetime', 'http_get', 'json'] },
  { name: 'Knowledge Specialist', description: 'Answers questions by retrieving and synthesizing from the knowledge base.', systemPrompt: 'You are the Knowledge Specialist for Voltx. Always ground answers in retrieved knowledge base content and cite the source document.', toolNames: ['json'] },
];

async function seedAgents(organizationId: string): Promise<Record<string, string>> {
  const agentIds: Record<string, string> = {};
  for (const agent of AGENT_DEFINITIONS) {
    const id = randomUUID();
    agentIds[agent.name] = id;
    await prisma.agent.create({
      data: {
        id,
        organizationId,
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        provider: 'openai',
        model: 'gpt-5-mini',
        configuration: { kind: 'demo', toolNames: agent.toolNames, temperature: 0.3, maxOutputTokens: 2048 },
        enabled: true,
      },
    });
  }
  console.log(`  seeded ${AGENT_DEFINITIONS.length} named agents`);
  return agentIds;
}

const WORKFLOW_DEFINITIONS = [
  { name: 'Lead Qualification', description: 'Qualifies inbound leads against MEDDIC criteria and routes to the right rep.', agentName: 'Sales Copilot', objective: 'Review the lead details and produce a MEDDIC qualification summary with a recommended next step.' },
  { name: 'Deal Approval', description: 'Routes discount requests beyond policy thresholds to Finance and Legal.', agentName: 'Finance Analyst', objective: 'Evaluate this deal against the Pricing Guide discount thresholds and flag whether Finance approval is required.' },
  { name: 'Customer Onboarding', description: 'Kicks off the 30/60/90 day onboarding plan for a newly signed customer.', agentName: 'Executive Assistant', objective: 'Draft the kickoff call agenda and 30/60/90 day onboarding plan for this customer.' },
  { name: 'Invoice Processing', description: 'Validates and routes incoming invoices for approval.', agentName: 'Finance Analyst', objective: 'Summarize this invoice and confirm whether it matches the expected contract terms.' },
  { name: 'Contract Review', description: 'Flags non-standard contract terms for Legal review.', agentName: 'Finance Analyst', objective: 'Review this contract summary against standard terms in the Pricing Guide and flag any deviations.' },
  { name: 'Support Escalation', description: 'Escalates unresolved support tickets per the Support SOP escalation matrix.', agentName: 'Customer Support Agent', objective: 'Determine the correct escalation path for this ticket per the Support SOP.' },
  { name: 'Security Incident', description: 'Coordinates the incident response runbook for a reported security event.', agentName: 'Operations Manager', objective: 'Classify the severity of this incident per the Incident Response runbook and outline the immediate next steps.' },
  { name: 'Executive Reporting', description: 'Compiles a weekly executive summary across pipeline, support, and operations.', agentName: 'Executive Assistant', objective: 'Summarize this week\'s pipeline movement, support ticket trends, and any open incidents for the executive team.' },
];

async function seedWorkflows(organizationId: string, userId: string): Promise<void> {
  for (const wf of WORKFLOW_DEFINITIONS) {
    const workflowId = randomUUID();
    await prisma.workflow.create({
      data: {
        id: workflowId,
        organizationId,
        name: wf.name,
        description: wf.description,
        status: 'PUBLISHED',
        publishedVersion: 1,
        createdBy: userId,
        versions: {
          create: {
            organizationId,
            version: 1,
            createdBy: userId,
            definition: {
              steps: [
                { id: 'context', name: 'Gather context', type: 'DELAY', config: { delayMs: 200 } },
                {
                  id: 'analyze',
                  name: `${wf.agentName} analysis`,
                  type: 'AGENT',
                  config: { agentName: wf.agentName, objective: wf.objective },
                  dependsOn: ['context'],
                },
              ],
            },
          },
        },
      },
    });
  }
  console.log(`  seeded ${WORKFLOW_DEFINITIONS.length} named workflows`);
}

async function seedKnowledgeGraph(
  organizationId: string,
  companyIds: Record<string, string>,
): Promise<void> {
  const companies = await prisma.salesCompany.findMany({ where: { organizationId } });
  const contacts = await prisma.salesContact.findMany({ where: { organizationId } });
  const opportunities = await prisma.salesOpportunity.findMany({ where: { organizationId } });

  const companyEntityIds = new Map<string, string>();
  for (const company of companies) {
    const entity = await prisma.knowledgeEntity.create({
      data: {
        organizationId,
        type: 'COMPANY',
        externalId: company.id,
        label: company.name,
        metadata: { industry: company.industry, status: company.status },
      },
    });
    companyEntityIds.set(company.id, entity.id);
  }

  const contactEntityIds = new Map<string, string>();
  for (const contact of contacts) {
    const entity = await prisma.knowledgeEntity.create({
      data: {
        organizationId,
        type: 'PERSON',
        externalId: contact.id,
        label: `${contact.firstName} ${contact.lastName}`,
        metadata: { jobTitle: contact.jobTitle },
      },
    });
    contactEntityIds.set(contact.id, entity.id);

    if (contact.companyId && companyEntityIds.has(contact.companyId)) {
      await prisma.knowledgeRelationship.create({
        data: {
          organizationId,
          fromEntityId: entity.id,
          toEntityId: companyEntityIds.get(contact.companyId)!,
          type: 'WORKS_AT',
        },
      });
    }
  }

  for (const opportunity of opportunities) {
    const entity = await prisma.knowledgeEntity.create({
      data: {
        organizationId,
        type: 'DEAL',
        externalId: opportunity.id,
        label: opportunity.title,
        metadata: { stage: opportunity.stage, amount: opportunity.amount },
      },
    });

    if (opportunity.companyId && companyEntityIds.has(opportunity.companyId)) {
      await prisma.knowledgeRelationship.create({
        data: {
          organizationId,
          fromEntityId: entity.id,
          toEntityId: companyEntityIds.get(opportunity.companyId)!,
          type: 'ASSOCIATED_WITH',
        },
      });
    }
    if (opportunity.contactId && contactEntityIds.has(opportunity.contactId)) {
      await prisma.knowledgeRelationship.create({
        data: {
          organizationId,
          fromEntityId: contactEntityIds.get(opportunity.contactId)!,
          toEntityId: entity.id,
          type: 'OWNS',
        },
      });
    }
  }

  console.log(
    `  seeded knowledge graph: ${companyEntityIds.size} companies, ${contactEntityIds.size} people, ${opportunities.length} deals, with WORKS_AT/OWNS/ASSOCIATED_WITH relationships`,
  );
}

async function main(): Promise<void> {
  console.log('Seeding VT-033 realistic enterprise demo data...\n');

  const { organizationId, userId, accessToken } = await bootstrapOrganization();
  await wipeExistingDemoData(organizationId);

  console.log('\nSeeding companies, contacts, opportunities, activities...');
  const { companyIds } = await seedCompaniesAndCrm(organizationId);

  console.log('\nSeeding knowledge base (real content, real embeddings)...');
  await seedKnowledgeBase(organizationId, accessToken);

  console.log('\nSeeding AI agents...');
  await seedAgents(organizationId);

  console.log('\nSeeding workflows...');
  await seedWorkflows(organizationId, userId);

  console.log('\nSeeding knowledge graph relationships...');
  await seedKnowledgeGraph(organizationId, companyIds);

  console.log('\nDone. Demo login:', DEMO_EMAIL, '/', DEMO_PASSWORD);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
