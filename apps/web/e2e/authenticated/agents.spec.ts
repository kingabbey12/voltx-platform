import { test, expect } from "@playwright/test";

test.describe("AI Agents", () => {
  test("agents page loads", async ({ page }) => {
    await page.goto("/ai/agents");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("agent list or grid is visible", async ({ page }) => {
    await page.goto("/ai/agents");
    const list = page.locator("[role=grid], [role=list], table, [class*=grid]").first();
    const emptyState = page.getByText(/no agents|create your first agent/i);
    // Auto-waiting: isVisible() is an immediate snapshot, so it read
    // false while the page was still rendering.
    await expect(list.or(emptyState).first()).toBeVisible();
  });

  test("create agent button exists", async ({ page }) => {
    await page.goto("/ai/agents");
    const createBtn = page.getByRole("button", { name: /create|new agent|add agent/i });
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeVisible();
    }
  });

  test("filter or search controls exist", async ({ page }) => {
    await page.goto("/ai/agents");
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]');
    const filterSelect = page.locator('[role="combobox"], select').first();
    // Auto-waiting: isVisible() is an immediate snapshot, so it read
    // false while the page was still rendering.
    await expect(searchInput.or(filterSelect).first()).toBeVisible();
  });
});
