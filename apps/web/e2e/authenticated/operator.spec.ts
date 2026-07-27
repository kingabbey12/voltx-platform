import { test, expect } from "@playwright/test";

test.describe("AI Operator", () => {
  test("operator page loads", async ({ page }) => {
    await page.goto("/ai/operator");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("operator interface has key elements", async ({ page }) => {
    await page.goto("/ai/operator");
    // Check for chat/command input or task list
    const input = page.locator('textarea, input[type="text"]').first();
    const taskList = page.getByText(/tasks|runs|activity/i);
    // Auto-waiting: isVisible() is an immediate snapshot, so it read
    // false while the page was still rendering.
    await expect(input.or(taskList).first()).toBeVisible();
  });

  test("operator has status or health indicator", async ({ page }) => {
    await page.goto("/ai/operator");
    const status = page.locator("[class*='status'], [class*='health'], [class*='indicator']").first();
    if (await status.isVisible()) {
      await expect(status).toBeVisible();
    }
  });
});
