import { expect, test } from "@playwright/test";

const OPPORTUNITY_ID = "11111111-1111-4111-8111-111111111111";

const HOSTILE_MARKDOWN = [
  "**Important**",
  "",
  "- First item",
  "- Second item",
  "",
  "[Safe link](https://example.com)",
  "",
  '<script>alert("xss")</script>',
  "",
  "<img src=x onerror=alert(1)>",
  "",
  "[Bad protocol](javascript:alert(1))",
].join("\n");

test("renders AI markdown without executing injected content", async ({ page }) => {
  const alerts: string[] = [];

  page.on("dialog", async (dialog) => {
    alerts.push(dialog.message());
    await dialog.dismiss();
  });

  await page.route("**/api/v1/sales/opportunities**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.endsWith(`/sales/opportunities/${OPPORTUNITY_ID}`)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            id: OPPORTUNITY_ID,
            name: "Markdown Security Test",
            stage: "QUALIFICATION",
            value: 50000,
            currency: "USD",
            probability: 25,
            insights: HOSTILE_MARKDOWN,
            nextBestAction: HOSTILE_MARKDOWN,
            company: null,
            contact: null,
            owner: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: OPPORTUNITY_ID,
              name: "Markdown Security Test",
              stage: "QUALIFICATION",
              value: 50000,
              currency: "USD",
              probability: 25,
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        },
      }),
    });
  });

  await page.goto(`/crm/opportunities/${OPPORTUNITY_ID}`);
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("**Important**", { exact: true })).toHaveCount(0);
  await expect(page.locator("strong", { hasText: "Important" }).first()).toBeVisible();
  await expect(page.locator("li", { hasText: "First item" }).first()).toBeVisible();

  await expect(page.locator("script:has-text('xss')")).toHaveCount(0);
  await expect(page.locator("img[onerror]")).toHaveCount(0);

  const safeLink = page.locator('a[href="https://example.com"]').first();
  await expect(safeLink).toHaveAttribute("rel", /noopener/);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);

  expect(alerts, "injected script executed").toEqual([]);
});
