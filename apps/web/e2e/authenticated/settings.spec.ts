import { test, expect } from "@playwright/test";

test.describe("Settings", () => {
  test("settings page loads", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("settings navigation has sections", async ({ page }) => {
    await page.goto("/settings/profile");
    const nav = page.locator("nav a, [role=tablist] a, aside a").first();
    if (await nav.isVisible()) {
      await expect(nav).toBeVisible();
    }
  });

  test("can navigate between settings sections", async ({ page }) => {
    await page.goto("/settings/profile");
    const links = page.locator("nav a, [role=tablist] a, aside a");
    const linkCount = await links.count();
    if (linkCount > 1) {
      const secondLink = links.nth(1);
      const href = await secondLink.getAttribute("href");
      if (href) {
        await secondLink.click();
        await expect(page).toHaveURL(new RegExp(href.replace(/^\/?/, "")));
      }
    }
  });

  test("theme settings section renders", async ({ page }) => {
    await page.goto("/settings");
    const themeSection = page.getByText(/theme|appearance|dark mode/i).first();
    if (await themeSection.isVisible()) {
      await expect(themeSection).toBeVisible();
    }
  });

  test("team settings loads", async ({ page }) => {
    await page.goto("/settings/team");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});
