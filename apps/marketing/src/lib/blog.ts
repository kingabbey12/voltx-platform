export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  date: string;
  readingMinutes: number;
  content: string[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "voltx-v2-3-developer-platform",
    title: "Voltx v2.3: a public API, SDKs, a CLI, and a marketplace",
    excerpt:
      "Voltx is now a platform other teams can build on — a documented REST API, OAuth applications, outbound webhooks, official SDKs, a CLI, and a marketplace with real revenue sharing.",
    category: "Product",
    author: "The Voltx Team",
    date: "2026-06-02",
    readingMinutes: 5,
    content: [
      "Every Voltx feature so far has been something our own team built for you. With v2.3, that changes: Voltx is now a platform other teams can build on top of, using the exact same primitives our own product runs on.",
      "The foundation is a public REST API described by a full OpenAPI 3.1 document, versioned at the URI level so integrations never break under you. Authentication comes in three flavors depending on what you're building: scoped API keys for server-to-server integrations, personal access tokens for individual developers scripting against their own account, and service accounts for machine identities that need their own audit trail.",
      "For anything that needs a real user's consent — not just an API key — we shipped a full OAuth 2.0 authorization server with mandatory PKCE. Register an application, redirect a user through the consent screen, and exchange a code for a token scoped to exactly what that user allowed. No shared secrets, no all-or-nothing access.",
      "Outbound webhooks round out the write side: subscribe to the events you care about, and every delivery is HMAC-signed so you can verify it actually came from Voltx. If a delivery fails, it retries with backoff, and if you ever need to replay one — because your endpoint was down, or you shipped a bug — the full delivery log lets you resend it without waiting for the next real event.",
      "None of this is much use without real clients, so we shipped official SDKs for TypeScript, Python, and Flutter, plus a CLI for scripting deploys and streaming logs from your terminal or CI. And for teams who want to go further than integrating — who want to publish something other organizations can install — the new Marketplace supports real paid listings with Stripe Connect revenue sharing, backed by a declarative Extension Framework that renders your Custom Pages and AI Tools through Voltx's own component system.",
      "This is the first release where 'the Voltx API' means something beyond 'what our own frontend calls.' Read the full reference in the Developer Portal, or start with our Developers page for an overview of what's available today.",
    ],
  },
  {
    slug: "how-voltx-enforces-tenant-isolation",
    title: "How Voltx enforces tenant isolation at the database layer",
    excerpt:
      "Row-level isolation in application code is easy to get wrong once. Voltx enforces it with a Prisma Client Extension that scopes every query automatically — defense in depth, not a single point of failure.",
    category: "Engineering",
    author: "The Voltx Team",
    date: "2026-04-14",
    readingMinutes: 4,
    content: [
      "Multi-tenancy bugs are rarely dramatic. They're a missing `WHERE organizationId = ?` clause in one query, out of the hundreds a real application accumulates, that quietly returns one customer's data to another. Code review catches most of them. It doesn't catch all of them, and in a multi-tenant SaaS product, 'most' isn't the bar.",
      "Voltx's approach is to treat tenant scoping as an ORM-level guarantee rather than a per-query discipline. Every request that reaches the API resolves a tenant context — organization, user, and request ID — into an async-local-storage-backed context service before any route handler runs. That context is then read by a Prisma Client Extension that intercepts every query against tenant-scoped models and injects the organization scope automatically.",
      "The result is defense in depth: even if a service method forgets to filter by organization explicitly, the extension still narrows the query at the ORM layer. It's not a replacement for careful application code — it's a second, independent enforcement point that fails closed rather than open.",
      "This same tenant context also powers our guard composition for protected routes: a JWT auth guard validates the bearer token, a user-context guard resolves membership and RBAC permissions, and a tenant guard cross-checks that the resolved organization actually matches what the token claims. Three checks, each independently simple to verify, composed into something much harder to get wrong than one guard trying to do all three jobs at once.",
      "We wrote more about the specific isolation guarantees this gives enterprise customers on our Enterprise page, including how it interacts with SCIM provisioning and audit logging.",
    ],
  },
  {
    slug: "extension-framework-declarative-by-design",
    title: "Why Voltx's Extension Framework doesn't run your code",
    excerpt:
      "Letting third-party apps render inside a customer's workspace is a real security boundary. We chose a fixed, declarative component palette over a sandboxed code runtime — here's why.",
    category: "Engineering",
    author: "The Voltx Team",
    date: "2026-07-20",
    readingMinutes: 4,
    content: [
      "When we designed the Marketplace's Extension Framework, the obvious approach was some flavor of sandboxed JavaScript execution — an iframe, a Web Worker, a WASM runtime — letting developers ship arbitrary UI code that runs inside a customer's own workspace. We decided against it.",
      "Sandboxing arbitrary code safely is its own large, ongoing security project, not a feature you bolt onto a release. Every sandbox has a history of escapes. And for the actual use case — a marketplace app rendering a settings page, a dashboard widget, or a data table — a fixed, declarative component palette gets you nearly everything a real integration needs without ever executing a byte of third-party code in the browser.",
      "So that's what we built: a Custom Page or Widget is a JSON manifest describing a tree of components from a fixed, versioned palette — table, stat-card, form, chart, and a handful of others — plus data-source bindings that the installing organization's own web app executes as an authenticated API call. The manifest is validated against that exact palette at submission time, before a platform admin ever reviews it, so a malformed manifest never even reaches the review queue.",
      "Custom AI Tools follow the same philosophy from a different angle: rather than running developer code in our AI runtime, a Custom AI Tool is an HMAC-signed HTTPS call to the developer's own endpoint — the same trust model as an outbound webhook, just invoked by the model instead of an event. The response is validated against the tool's own declared JSON Schema before it's ever handed back to the model as fact.",
      "The trade-off is real: a developer can't ship a fully custom, bespoke UI the way they could with arbitrary code. What they get instead is an app that renders through the same component system every first-party Voltx screen uses — consistent, reviewable, and running in every customer's workspace without asking anyone to trust a third party's JavaScript.",
    ],
  },
  {
    slug: "sales-copilot-context-not-just-chat",
    title: "Sales Copilot: an AI agent that reasons about your pipeline",
    excerpt:
      "The difference between a chatbot bolted onto a CRM and an agent that actually understands your pipeline is context — and being willing to call tools, not just generate text.",
    category: "Product",
    author: "The Voltx Team",
    date: "2026-02-18",
    readingMinutes: 4,
    content: [
      "Most 'AI in your CRM' features are a chat window that can answer questions about a record you already have open. That's useful, but it's not what a sales rep actually needs at 4pm on a Friday with twelve deals in different states of attention.",
      "Voltx's Sales Copilot is built as an agent, not a chat feature: it plans multi-step tasks, calls real tools against your pipeline data, and hands off to specialist agents when a task needs it — drafting a follow-up email is a different kind of work than qualifying a new lead, and the agent runtime treats them differently rather than forcing one generic prompt to do both badly.",
      "Concretely, that means the Copilot can look at an opportunity's full activity history, cross-reference it against your knowledge graph for anything relevant a teammate wrote down in a different deal, and draft a follow-up that actually reflects where the conversation left off — not a generic template with the contact's name swapped in.",
      "It also means every action the agent takes is auditable. Tool calls are logged, permissioned against the same RBAC system that governs human users, and constrained to what that agent's configuration actually allows. Autonomy doesn't mean the agent can do anything — it means it can do a lot, safely, within limits you set.",
      "If you're evaluating Voltx for a sales team specifically, the Solutions page has a deeper look at how this fits alongside pipeline management and CRM data.",
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return blogPosts.find((post) => post.slug === slug);
}
