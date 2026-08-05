import { test, expect } from "@playwright/test";

test.describe("Workflows", () => {
  test("requires a draft to be published before it can run", async ({ page }) => {
    const envelope = (data: unknown) => ({
      success: true,
      data,
      meta: {
        requestId: "draft-workflow-test",
        timestamp: "2026-08-05T00:00:00.000Z",
        version: "1",
      },
    });

    await page.route(/\/api\/v1\/workflows\/draft-workflow(?:\/.*)?$/, (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname.endsWith("/versions")) {
        return route.fulfill({ json: envelope([]) });
      }
      if (pathname.endsWith("/runs")) {
        return route.fulfill({
          json: envelope({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
        });
      }
      if (pathname.endsWith("/metrics")) {
        return route.fulfill({
          json: envelope({
            totalRuns: 0,
            succeededRuns: 0,
            failedRuns: 0,
            cancelledRuns: 0,
            successRate: 0,
            failureRate: 0,
            averageExecutionTimeMs: 0,
            averageQueueTimeMs: 0,
            totalRetries: 0,
            agentStepCount: 0,
            toolStepCount: 0,
            totalTokens: 0,
            totalCostUsd: 0,
          }),
        });
      }

      return route.fulfill({
        json: envelope({
          id: "draft-workflow",
          name: "Draft workflow",
          description: "Must be published before execution.",
          status: "DRAFT",
          publishedVersion: null,
          createdAt: "2026-08-05T00:00:00.000Z",
          updatedAt: "2026-08-05T00:00:00.000Z",
        }),
      });
    });

    await page.goto("/workflows/draft-workflow");

    await expect(page.getByRole("button", { name: "Run now" })).toBeDisabled();
    await expect(page.getByText("Publish this draft before it can run.")).toBeVisible();
  });

  test("workflows page loads", async ({ page }) => {
    await page.goto("/workflows");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("workflow list or empty state is visible", async ({ page }) => {
    await page.goto("/workflows");
    const list = page.locator("[role=grid], [role=list], table, [class*=grid]").first();
    const emptyState = page.getByText(/no workflows|create your first/i);
    // Auto-waiting: isVisible() is an immediate snapshot, so it read
    // false while the page was still rendering.
    await expect(list.or(emptyState).first()).toBeVisible();
  });

  test("create workflow button exists", async ({ page }) => {
    await page.goto("/workflows");
    const pageHeader = page.locator("header").filter({
      has: page.getByRole("heading", { name: "Workflows", exact: true }),
    });
    await expect(
      pageHeader.getByRole("button", { name: "New workflow", exact: true }),
    ).toBeVisible();
  });

  test("templates section loads", async ({ page }) => {
    await page.goto("/workflows/templates");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("approvals page loads", async ({ page }) => {
    await page.goto("/workflows/approvals");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
