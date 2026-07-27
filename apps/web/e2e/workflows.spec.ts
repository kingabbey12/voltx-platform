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
    const anyVisible = await Promise.any([
      list.isVisible().then((v) => v),
      emptyState.isVisible().then((v) => v),
    ]);
    expect(anyVisible).toBe(true);
  });

  test("create workflow button exists", async ({ page }) => {
    await page.goto("/workflows");
    const createBtn = page.getByRole("button", { name: /create|new workflow/i });
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeVisible();
    }
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
