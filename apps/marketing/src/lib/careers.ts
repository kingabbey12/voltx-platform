export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
}

export const jobListings: JobListing[] = [
  {
    id: "senior-backend-engineer",
    title: "Senior Backend Engineer",
    department: "Engineering",
    location: "Remote (US/EU)",
    type: "Full-time",
    description:
      "Own core platform services — multi-tenancy, the AI agent runtime, and the public API — built on NestJS and Prisma/PostgreSQL.",
    requirements: [
      "5+ years building production backend systems",
      "Deep experience with PostgreSQL and relational data modeling",
      "Comfortable owning a service from design through on-call",
    ],
  },
  {
    id: "frontend-engineer",
    title: "Frontend Engineer",
    department: "Engineering",
    location: "Remote (US/EU)",
    type: "Full-time",
    description:
      "Build the app.usevoltx.com product experience — dashboard, CRM, workflows, and the developer portal — in Next.js and TypeScript.",
    requirements: [
      "3+ years of production React/Next.js experience",
      "An eye for interaction detail and motion, not just layout",
      "Experience working directly from a design system, not around one",
    ],
  },
  {
    id: "flutter-mobile-engineer",
    title: "Flutter Mobile Engineer",
    department: "Engineering",
    location: "Remote (US/EU)",
    type: "Full-time",
    description:
      "Build and maintain the Voltx mobile app — feature parity with web, offline-aware, on a Riverpod + go_router architecture.",
    requirements: [
      "2+ years shipping production Flutter apps",
      "Experience with Riverpod or a comparable state-management approach",
      "Comfortable working from a token-based design system",
    ],
  },
  {
    id: "ai-agent-engineer",
    title: "AI Agent Engineer",
    department: "AI / Machine Learning",
    location: "Remote (US/EU)",
    type: "Full-time",
    description:
      "Work on the agent runtime that powers Sales Copilot and Custom AI Tools — planning, tool execution, memory, and multi-agent delegation.",
    requirements: [
      "Experience building production LLM-backed systems, not just prototypes",
      "Strong opinions about evaluation, not just prompt design",
      "Comfortable reasoning about cost, latency, and failure modes at scale",
    ],
  },
  {
    id: "enterprise-solutions-engineer",
    title: "Enterprise Solutions Engineer",
    department: "Sales",
    location: "Remote (US)",
    type: "Full-time",
    description:
      "Be the technical voice in enterprise deals — security reviews, SSO/SCIM rollouts, and scoping custom integrations alongside prospective customers.",
    requirements: [
      "Experience running technical evaluations for enterprise SaaS buyers",
      "Comfortable speaking to SSO, SCIM, and tenant isolation in detail",
      "Strong written communication for security questionnaires and RFPs",
    ],
  },
  {
    id: "product-designer",
    title: "Product Designer",
    department: "Design",
    location: "Remote (US/EU)",
    type: "Full-time",
    description:
      "Design across the entire Voltx product surface — dashboard, CRM, workflows, and the marketing site — within our black-and-gold design system.",
    requirements: [
      "A portfolio showing systems-level thinking, not just individual screens",
      "Experience designing complex, data-dense B2B products",
      "Comfortable partnering closely with engineering on implementation",
    ],
  },
];

export function getJobListing(id: string): JobListing | undefined {
  return jobListings.find((job) => job.id === id);
}
