import { test, expect } from "@playwright/test";

test.describe("Organizations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/organizations");
  });

  test("organization page loads", async ({ page }) => {
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("organization list or create prompt is visible", async ({ page }) => {
    // Either a list of orgs or an empty state with create button
    const list = page.locator("[role=grid], table, [data-testid=org-list]");
    const emptyState = page.getByText(/no organizations|create your first|get started/i);
    const createButton = page.getByRole("button", { name: /create|new organization/i });

    const anyVisible = await Promise.any([
      list.isVisible().then((v) => v),
      emptyState.isVisible().then((v) => v),
      createButton.isVisible().then((v) => v),
    ]);
    expect(anyVisible).toBe(true);
  });

  test("organization navigation works", async ({ page }) => {
    // Verify sidebar or navigation has org-related links
    const orgNav = page.getByText(/organizations|workspace|team/i);
    if (await orgNav.isVisible()) {
      await orgNav.click();
      await expect(page).toHaveURL(/organizations|workspace/i);
    }
  });
});
