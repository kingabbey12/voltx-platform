import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Captures authenticated pages so design-system changes can actually be looked
 * at. Not assertions — this is a review aid. It runs in its own `screenshots`
 * project so it never gates CI.
 *
 * Run it via scripts/dev-authenticated-env.sh, which supplies the API, a seeded
 * database and a user whose onboarding is complete. Without that last part
 * every route redirects into the onboarding wizard and you screenshot the wrong
 * thing entirely.
 */

const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES: Array<{ name: string; path: string; fixture?: "conversation" | "workflow" | "analytics" | "agentAnalytics" }> = [
  { name: "dashboard", path: "/dashboard", fixture: "analytics" },
  { name: "ai-operator", path: "/ai/operator" },
  { name: "ai-agents", path: "/ai/agents" },
  { name: "agent-analytics", path: "/ai/agents/visual-agent/analytics", fixture: "agentAnalytics" },
  { name: "communications-home", path: "/inbox" },
  { name: "communication-conversation", path: "/inbox/visual-conversation", fixture: "conversation" },
  { name: "crm-companies", path: "/crm/companies" },
  { name: "crm-leads", path: "/crm/leads" },
  { name: "crm-opportunities", path: "/crm/opportunities" },
  { name: "workflows", path: "/workflows", fixture: "workflow" },
  { name: "workflow-detail", path: "/workflows/visual-workflow", fixture: "workflow" },
  { name: "workflow-builder", path: "/workflows/visual-workflow/builder", fixture: "workflow" },
  { name: "settings", path: "/settings" },
];

async function configureConversationFixture(page: Page) {
  const conversation = {
    id: "visual-conversation",
    connectionId: "visual-connection",
    contactId: "visual-contact",
    assigneeId: null,
    channel: "WHATSAPP",
    subject: "Renewal discussion: rollout timeline",
    status: "PINNED",
    priority: "HIGH",
    unread: false,
    lastMessageAt: "2026-08-02T14:30:00.000Z",
    createdAt: "2026-08-01T10:00:00.000Z",
  };
  const messages = {
    items: [
      { id: "visual-message-1", conversationId: conversation.id, direction: "INBOUND", channel: "WHATSAPP", status: "DELIVERED", body: "We are ready to align on the rollout timeline and commercial terms.", createdAt: "2026-08-02T13:55:00.000Z" },
      { id: "visual-message-2", conversationId: conversation.id, direction: "OUTBOUND", channel: "WHATSAPP", status: "SENT", body: "Thanks for the update. I will share the proposed timeline and the next decision points today.", createdAt: "2026-08-02T14:08:00.000Z" },
      { id: "visual-message-3", conversationId: conversation.id, direction: "INBOUND", channel: "WHATSAPP", status: "DELIVERED", body: "Perfect. Please include the implementation team so we can confirm ownership.", createdAt: "2026-08-02T14:30:00.000Z" },
    ],
    total: 3,
  };

  await page.route("**/api/v1/communications/conversations/visual-conversation", (route) =>
    route.fulfill({ json: { success: true, data: conversation } }),
  );
  await page.route("**/api/v1/communications/conversations/visual-conversation/messages**", (route) =>
    route.fulfill({ json: { success: true, data: messages } }),
  );
}

async function configureWorkflowFixture(page: Page) {
  const workflow = {
    id: "visual-workflow",
    name: "New customer follow-up",
    description: "Reviews a new customer, pauses for approval, then sends a notification.",
    status: "PUBLISHED",
    publishedVersion: 3,
    createdAt: "2026-08-01T09:00:00.000Z",
    updatedAt: "2026-08-02T14:20:00.000Z",
  };
  const definition = {
    steps: [
      { id: "review_customer", name: "Review customer", type: "AGENT", config: { agentName: "Workflow Assistant", objective: "Review the new customer context." }, layout: { x: 180, y: 40 } },
      { id: "request_approval", name: "Request review", type: "APPROVAL", dependsOn: ["review_customer"], config: { message: "Approve the customer follow-up?", approverRole: "manager" }, layout: { x: 180, y: 250 } },
      { id: "send_notification", name: "Notify account team", type: "NOTIFICATION", dependsOn: ["request_approval"], config: { channel: "notification", message: "Customer follow-up is approved.", title: "Follow-up ready" }, layout: { x: 180, y: 460 } },
    ],
  };
  const version = {
    id: "visual-workflow-version",
    workflowId: workflow.id,
    version: 3,
    definition,
    createdBy: "uiqa-user",
    createdAt: "2026-08-02T14:20:00.000Z",
  };
  const failedRun = {
    id: "visual-failed-run",
    workflowId: workflow.id,
    workflowVersionId: version.id,
    status: "FAILED",
    triggerType: "MANUAL",
    input: {},
    context: {},
    output: {},
    currentStepId: "request_approval",
    error: "The approver role is not available for this workspace.",
    startedAt: "2026-08-02T14:10:00.000Z",
    completedAt: "2026-08-02T14:10:08.000Z",
    durationMs: 8_000,
    createdAt: "2026-08-02T14:10:00.000Z",
  };
  const envelope = (data: unknown) => ({ success: true, data });

  await page.route(/\/api\/v1\/workflows(?:\?.*)?$/, (route) =>
    route.fulfill({ json: envelope({ items: [workflow], total: 1 }) }),
  );
  await page.route("**/api/v1/workflows/visual-workflow/versions", (route) =>
    route.fulfill({ json: envelope([version]) }),
  );
  await page.route("**/api/v1/workflows/visual-workflow/runs**", (route) =>
    route.fulfill({ json: envelope({ items: [failedRun], total: 1 }) }),
  );
  await page.route("**/api/v1/workflows/visual-workflow/metrics", (route) =>
    route.fulfill({ json: envelope({ totalRuns: 12, succeededRuns: 10, failedRuns: 2, cancelledRuns: 0, successRate: 10 / 12, failureRate: 2 / 12, averageExecutionTimeMs: 5_300, averageQueueTimeMs: 200, totalRetries: 1, agentStepCount: 1, toolStepCount: 0, totalTokens: 0, totalCostUsd: 0 }) }),
  );
  await page.route("**/api/v1/workflows/runs/visual-failed-run/logs**", (route) =>
    route.fulfill({ json: envelope({ items: [{ id: "visual-log-1", workflowRunId: failedRun.id, stepRunId: null, level: "ERROR", event: "StepFailed", message: "Approval could not be assigned to the configured role.", metadata: {}, createdAt: "2026-08-02T14:10:08.000Z" }], total: 1 }) }),
  );
  await page.route("**/api/v1/workflows/runs/visual-failed-run/checkpoints", (route) =>
    route.fulfill({ json: envelope([{ id: "visual-checkpoint-1", workflowRunId: failedRun.id, stepId: "review_customer", state: {}, createdAt: "2026-08-02T14:10:03.000Z" }]) }),
  );
  await page.route("**/api/v1/workflows/visual-workflow", (route) =>
    route.fulfill({ json: envelope(workflow) }),
  );
}

async function configureAnalyticsFixture(page: Page) {
  const envelope = (data: unknown) => ({ success: true, data });
  const metrics = {
    snapshot: {
      companies: 24,
      contacts: 86,
      leads: 41,
      qualifiedLeads: 18,
      opportunities: 16,
      openOpportunities: 12,
      openActivities: 9,
      pipelineValue: 284000,
      wonValue: 97000,
    },
    trends: {
      pipelineValue: [{ date: "2026-07-28", value: 195000 }, { date: "2026-07-29", value: 213000 }, { date: "2026-07-30", value: 228000 }, { date: "2026-07-31", value: 247000 }, { date: "2026-08-01", value: 261000 }, { date: "2026-08-02", value: 284000 }],
      qualifiedLeads: [{ date: "2026-07-28", value: 11 }, { date: "2026-07-29", value: 12 }, { date: "2026-07-30", value: 13 }, { date: "2026-07-31", value: 15 }, { date: "2026-08-01", value: 16 }, { date: "2026-08-02", value: 18 }],
      companies: [{ date: "2026-07-28", value: 19 }, { date: "2026-07-29", value: 20 }, { date: "2026-07-30", value: 21 }, { date: "2026-07-31", value: 22 }, { date: "2026-08-01", value: 23 }, { date: "2026-08-02", value: 24 }],
      openOpportunities: [{ date: "2026-07-28", value: 9 }, { date: "2026-07-29", value: 10 }, { date: "2026-07-30", value: 10 }, { date: "2026-07-31", value: 11 }, { date: "2026-08-01", value: 11 }, { date: "2026-08-02", value: 12 }],
      openActivities: [{ date: "2026-07-28", value: 14 }, { date: "2026-07-29", value: 13 }, { date: "2026-07-30", value: 12 }, { date: "2026-07-31", value: 11 }, { date: "2026-08-01", value: 10 }, { date: "2026-08-02", value: 9 }],
    },
    changes: {
      pipelineValue: { absolute: 89000, percent: 0.456, comparedTo: "since 2026-07-28" },
      qualifiedLeads: { absolute: 7, percent: 0.636, comparedTo: "since 2026-07-28" },
      companies: { absolute: 5, percent: 0.263, comparedTo: "since 2026-07-28" },
      openOpportunities: { absolute: 3, percent: 0.333, comparedTo: "since 2026-07-28" },
      openActivities: { absolute: -5, percent: -0.357, comparedTo: "since 2026-07-28" },
    },
    health: { score: 78, status: "healthy", factors: [{ label: "Pipeline momentum", impact: "positive" }, { label: "Open activity workload", impact: "neutral" }] },
    insights: [{ type: "opportunity", title: "Qualified pipeline is expanding", explanation: "Qualified leads and open opportunities both increased across the recorded history.", confidence: 0.86 }],
    priorities: [],
    meta: { historyDays: 30, generatedAt: "2026-08-02T14:30:00.000Z" },
  };
  const recommendations = [{ id: "visual-recommendation", category: "SALES", severity: "OPPORTUNITY", status: "OPEN", title: "Review new qualified opportunities", summary: "New sales-ready records need review.", explanation: "The executive snapshot shows more qualified leads than at the start of the recorded period.", businessImpact: "Keep new qualified demand moving through the pipeline.", recommendedNextStep: "Review qualified leads and assign follow-up.", confidence: 0.86, generatedAt: "2026-08-02T14:00:00.000Z", expiresAt: null, staleAt: null, evidence: [{ type: "lead", recordId: "visual-lead", recordLabel: "Northstar expansion", reason: "The lead was qualified during the recorded period.", href: "/crm/leads/visual-lead" }], actions: [{ id: "visual-create-task", type: "CREATE_TASK", label: "Create follow-up task", requiresApproval: true, payload: {}, executedAt: null }] }];
  const brief = { summary: "Pipeline value and qualified lead volume increased across the recorded history. Review the new sales-ready demand while activity workload remains manageable.", generatedAt: "2026-08-02T14:30:00.000Z", dataFreshness: "Updated from the current executive snapshot", changes: recommendations, wins: [], risks: [], recommendedNextActions: recommendations };

  await page.route(/\/api\/v1\/dashboard\/metrics(?:\?.*)?$/, (route) => route.fulfill({ json: envelope(metrics) }));
  await page.route("**/api/v1/dashboard/brief", (route) => route.fulfill({ json: envelope(brief) }));
  await page.route("**/api/v1/dashboard/recommendations", (route) => route.fulfill({ json: envelope(recommendations) }));
}

async function configureAgentAnalyticsFixture(page: Page) {
  const envelope = (data: unknown) => ({ success: true, data });
  const agent = { id: "visual-agent", name: "Sales Executive", description: "Reviews verified sales activity.", systemPrompt: "", provider: "openai", model: "gpt-4o-mini", configuration: {}, enabled: true, createdAt: "2026-08-01T10:00:00.000Z", updatedAt: "2026-08-02T12:00:00.000Z" };
  const stats = { agentId: agent.id, toolCount: 4, totalRunCount: 18, succeededRunCount: 15, lastRunAt: "2026-08-02T12:00:00.000Z" };
  const performance = { lookbackDays: 30, totalCallCount: 25, totalTokens: 44100, totalCostUsd: 2.14, byAgent: [{ agentId: agent.id, agentName: agent.name, callCount: 18, totalTokens: 31200, totalCostUsd: 1.57 }] };

  await page.route("**/api/v1/ai/agents/visual-agent", (route) => route.fulfill({ json: envelope(agent) }));
  await page.route("**/api/v1/ai/agents/visual-agent/stats", (route) => route.fulfill({ json: envelope(stats) }));
  await page.route("**/api/v1/ai/dashboard/performance?lookbackDays=30", (route) => route.fulfill({ json: envelope(performance) }));
}

/**
 * Heights are deliberately taller than a real display.
 *
 * `fullPage: true` measures the document's scroll height, but DashboardShell
 * pins the document to h-svh and scrolls an inner <main> instead — so Playwright
 * saw a 900px page and silently cropped everything below the fold. Capturing at
 * an over-tall viewport is what actually reveals the whole page.
 */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 2200 },
  { name: "tablet", width: 1024, height: 1600 },
  { name: "mobile", width: 390, height: 2200 },
];

/**
 * framer-motion drives entrance animations with requestAnimationFrame, which
 * does not tick while a tab is backgrounded — elements then sit at their
 * `initial` opacity and the capture comes back blank. Waiting for the network
 * to settle is not enough; wait until the animated content has actually
 * committed to its final opacity.
 */
async function waitForMotionToSettle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("main [style*='opacity']")].every(
          (el) => Number(getComputedStyle(el).opacity) > 0.99,
        ),
      undefined,
      { timeout: 5_000 },
    )
    .catch(() => {
      // Some pages have no motion wrappers at all — not a failure.
    });
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const target of PAGES) {
      test(`${target.name}`, async ({ page }) => {
        if (target.fixture === "conversation") {
          await configureConversationFixture(page);
        }
        if (target.fixture === "workflow") {
          await configureWorkflowFixture(page);
        }
        if (target.fixture === "analytics") {
          await configureAnalyticsFixture(page);
        }
        if (target.fixture === "agentAnalytics") {
          await configureAgentAnalyticsFixture(page);
        }
        await page.goto(target.path);

        // Confirms the auth guard actually let us through. If this fails the
        // session is wrong and every screenshot below would be the login page.
        await expect(page).not.toHaveURL(/\/login|\/onboarding/, { timeout: 20_000 });

        await waitForMotionToSettle(page);
        await page.screenshot({
          path: `${OUT}/${target.name}-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }

    test("ai-copilot", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).not.toHaveURL(/\/login|\/onboarding/, { timeout: 20_000 });
      await page.getByRole("button", { name: "Toggle AI assistant" }).click();
      await expect(page.locator("p:has-text('AI Copilot'):visible").first()).toBeVisible();
      await waitForMotionToSettle(page);
      await page.screenshot({ path: `${OUT}/ai-copilot-${viewport.name}.png`, fullPage: true });
    });

    test("command-palette", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page).not.toHaveURL(/\/login|\/onboarding/, { timeout: 20_000 });
      await page.keyboard.press("Meta+k");
      await expect(page.getByPlaceholder("Search your operating system...")).toBeVisible();
      await page.screenshot({ path: `${OUT}/command-palette-${viewport.name}.png`, fullPage: true });
    });

    test("workflow-selected-node", async ({ page }) => {
      await configureWorkflowFixture(page);
      await page.goto("/workflows/visual-workflow/builder");
      await expect(page.getByText("Request review", { exact: true })).toBeVisible();
      await page.getByText("Request review", { exact: true }).click();
      await expect(page.getByLabel("Request review configuration")).toBeVisible();
      await page.screenshot({ path: `${OUT}/workflow-selected-node-${viewport.name}.png`, fullPage: true });
    });

    test("workflow-failed-run-detail", async ({ page }) => {
      await configureWorkflowFixture(page);
      await page.goto("/workflows/visual-workflow");
      await expect(page.getByText("MANUAL", { exact: true })).toBeVisible();
      await page.getByText("MANUAL", { exact: true }).click();
      await expect(page.getByRole("heading", { name: "Execution timeline", exact: true })).toBeVisible();
      await page.screenshot({ path: `${OUT}/workflow-failed-run-detail-${viewport.name}.png`, fullPage: true });
    });

    test("analytics-kpi-detail", async ({ page }) => {
      await configureAnalyticsFixture(page);
      await page.goto("/dashboard");
      const revenueCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Revenue overview", exact: true }) });
      await revenueCard.getByRole("button", { name: /view metric detail/i }).click();
      await expect(page.getByRole("dialog", { name: "Revenue overview" })).toBeVisible();
      await page.screenshot({ path: `${OUT}/analytics-kpi-detail-${viewport.name}.png`, fullPage: true });
    });

    test("executive-morning-brief", async ({ page }) => {
      await configureAnalyticsFixture(page);
      await page.goto("/dashboard");
      await page.getByRole("button", { name: "Open morning briefing" }).click();
      await expect(page.getByRole("dialog", { name: "Executive morning briefing" })).toBeVisible();
      await page.screenshot({ path: `${OUT}/executive-morning-brief-${viewport.name}.png`, fullPage: true });
    });

    test("recommendation-explanation", async ({ page }) => {
      await configureAnalyticsFixture(page);
      await page.goto("/dashboard");
      await page.getByRole("button", { name: /Review Review new qualified opportunities/i }).first().click();
      await expect(page.getByRole("dialog", { name: "Review new qualified opportunities" })).toBeVisible();
      await page.screenshot({ path: `${OUT}/recommendation-explanation-${viewport.name}.png`, fullPage: true });
    });

    test("crm-ai-context", async ({ page }) => {
      await page.goto("/crm/companies");
      await page.getByRole("button", { name: "Toggle AI assistant" }).click();
      const contextPanel = page.locator('section[aria-label="AI context: CRM"]:visible');
      await expect(contextPanel).toBeVisible();
      await expect(contextPanel).toContainText("CRM");
      await expect(contextPanel.getByText("Data boundary", { exact: true })).toBeVisible();
      await page.screenshot({ path: `${OUT}/crm-ai-context-${viewport.name}.png`, fullPage: true });
    });
  });
}
