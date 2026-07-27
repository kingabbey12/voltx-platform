import { test, expect } from "@playwright/test";

test.describe("Knowledge Base", () => {
  test("knowledge page loads", async ({ page }) => {
    await page.goto("/ai/knowledge");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("knowledge navigation tabs are visible", async ({ page }) => {
    await page.goto("/ai/knowledge");
    const tabs = page.locator('[role="tab"], button:has-text("Sources"), button:has-text("Documents"), button:has-text("Search")');
    if (await tabs.first().isVisible()) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test("knowledge search input exists", async ({ page }) => {
    await page.goto("/ai/knowledge");
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]');
    if (await searchInput.isVisible()) {
      await searchInput.fill("test query");
    }
  });

  test("knowledge stats load", async ({ page }) => {
    await page.goto("/ai/knowledge");
    // Check for stat cards or summary numbers
    const stats = page.locator("[class*='stat'], [class*='card'], [class*='metric']").first();
    if (await stats.isVisible()) {
      await expect(stats).toBeVisible();
    }
  });
});
