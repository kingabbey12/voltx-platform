import { expect, test } from "@playwright/test";

test.describe("Executive dashboard", () => {
  test("renders the executive workspace with real data surfaces", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).not.toHaveURL(/\/login|\/onboarding/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/good (morning|afternoon|evening)/i);
    await expect(page.getByRole("heading", { name: "Your AI Chief of Staff" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today's brief" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Business health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Priorities", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await expect(page.getByLabel("Executive performance")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Understand the business, not just the numbers." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Workflow performance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Communication trends" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Executive report" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What needs executive attention." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Executive priorities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Executive risks" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Executive opportunities" })).toBeVisible();
  });

  test("uses canonical routes for dashboard actions", async ({ page }) => {
    await page.goto("/dashboard");
    const quickActions = page.locator('section[aria-labelledby="quick-actions-title"]');

    await expect(quickActions.getByRole("link", { name: /ai chat/i })).toHaveAttribute("href", "/ai");
    await expect(quickActions.getByRole("link", { name: /companies/i })).toHaveAttribute("href", "/crm/companies");
    await expect(quickActions.getByRole("link", { name: /leads/i })).toHaveAttribute("href", "/crm/leads");
    await expect(quickActions.getByRole("link", { name: /automation/i })).toHaveAttribute("href", "/workflows");
    await expect(quickActions.getByRole("link", { name: /deals/i })).toHaveAttribute("href", "/crm/opportunities");
    await expect(quickActions.getByRole("link", { name: /integrations/i })).toHaveAttribute("href", "/integrations");
    await expect(page.getByRole("link", { name: /chat with ai/i })).toHaveAttribute("href", "/ai");
    await expect(page.getByRole("link", { name: /view recommendations/i })).toHaveAttribute("href", "#priorities");
  });

  test("keeps mobile operating controls reachable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "AI" })).toHaveAttribute("href", "/ai");
    await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Revenue overview" })).toBeVisible();
  });

  test("explains analytics that do not have enough supported history", async ({ page }) => {
    await page.goto("/dashboard");
    const workflows = page.locator("#workflows");
    await expect(workflows.getByText("Trend unavailable")).toBeVisible();
    await expect(workflows.getByText(/workflow execution history/i)).toBeVisible();
    await expect(workflows.getByText(/more historical information is required/i)).toBeVisible();
  });

  test("opens a contextual AI panel without a page-specific recommendation fetch", async ({ page }) => {
    await page.goto("/crm/companies");
    await page.getByRole("button", { name: "Toggle AI assistant" }).click();

    const contextPanel = page.locator('section[aria-label="AI context: CRM"]:visible');
    await expect(contextPanel).toBeVisible();
    await expect(contextPanel).toContainText("CRM");
    await expect(contextPanel.getByText("Data boundary", { exact: true })).toBeVisible();
    await expect(contextPanel.getByText(/no aggregate CRM risk feed/i)).toBeVisible();
  });
});
