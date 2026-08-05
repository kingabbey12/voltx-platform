import { test, expect } from "@playwright/test";

test.describe("AI Agents", () => {
  test("renders the backend's array list contract", async ({ page }) => {
    await page.route(/\/api\/v1\/ai\/agents(?:\?.*)?$/, (route) =>
      route.fulfill({
        json: {
          success: true,
          data: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              name: "Contract Agent",
              description: "Verifies array list normalization.",
              systemPrompt: "Be concise.",
              provider: "openai",
              model: "gpt-5-mini",
              configuration: { kind: "custom" },
              enabled: false,
              createdAt: "2026-08-05T00:00:00.000Z",
              updatedAt: "2026-08-05T00:00:00.000Z",
            },
          ],
          meta: {
            requestId: "agent-contract-test",
            timestamp: "2026-08-05T00:00:00.000Z",
            version: "1",
          },
        },
      }),
    );

    await page.goto("/ai/agents");

    await expect(page.getByText("1 configured agents")).toBeVisible();
    await expect(page.getByText("Contract Agent", { exact: true })).toBeVisible();
  });

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
    const agentHero = page.locator(".surface-raised").filter({
      has: page.getByRole("heading", { name: "AI Agents", exact: true }),
    });
    await expect(agentHero.getByRole("button", { name: "New Agent", exact: true })).toBeVisible();
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
