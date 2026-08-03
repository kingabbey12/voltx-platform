import { test, expect } from "@playwright/test";

test.describe("Workflows", () => {
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
