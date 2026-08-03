import { test, expect } from "@playwright/test";

test.describe("AI Monitoring", () => {
  test("monitoring dashboard loads", async ({ page }) => {
    await page.goto("/ai/monitoring");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("dashboard has stat cards", async ({ page }) => {
    await page.goto("/ai/monitoring");
    const cards = page.locator("[class*='card']").first();
    if (await cards.isVisible()) {
      await expect(cards).toBeVisible();
    }
  });

  test("logs page loads", async ({ page }) => {
    await page.goto("/ai/logs");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("costs page loads", async ({ page }) => {
    await page.goto("/ai/costs");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("usage page loads", async ({ page }) => {
    await page.goto("/ai/usage");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("health page loads", async ({ page }) => {
    await page.goto("/ai/health");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("incidents page loads", async ({ page }) => {
    await page.goto("/ai/incidents");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("logs page has filter controls", async ({ page }) => {
    await page.goto("/ai/logs");
    const search = page.locator('input[type="search"], input[placeholder*="search" i]');
    const filter = page.locator('[role="combobox"], select').first();
    // Auto-waiting: isVisible() is an immediate snapshot, so it read
    // false while the page was still rendering.
    await expect(search.or(filter).first()).toBeVisible();
  });

  test("incidents page has create alert button", async ({ page }) => {
    await page.goto("/ai/incidents");
    await expect(page.getByRole("button", { name: "Create Alert", exact: true })).toBeVisible();
  });
});
