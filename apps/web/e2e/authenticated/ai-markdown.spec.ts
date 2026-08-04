import { expect, test } from "@playwright/test";

/**
 * AI-generated summaries are model output rendered into the CEO's browser, so
 * they are both a formatting problem and an injection surface.
 *
 * They used to render inside `<p className="whitespace-pre-wrap">`, which shows
 * `**bold**` and `- item` as literal characters. Switching them to the existing
 * MarkdownMessage fixes the formatting; these assertions pin the security
 * properties that make that switch safe, so nobody later "improves" it by
 * adding rehype-raw or dangerouslySetInnerHTML.
 *
 * The payload below is served by intercepting the opportunity request rather
 * than asking a real model for it — the point is what the renderer does with
 * hostile input, which a live model would not reliably produce.
 */
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

  let opportunityId: string | null = null;

  await page.route("**/api/v1/sales/opportunities**", async (route) => {
    const response = await route.fetch();
    const body = await response.json().catch(() => null);
    if (!body?.data) return route.fulfill({ response });

    // List response: remember an id so we can open its detail page.
    if (Array.isArray(body.data) || Array.isArray(body.data?.items)) {
      const items = Array.isArray(body.data) ? body.data : body.data.items;
      opportunityId ??= items[0]?.id ?? null;
      return route.fulfill({ response, body: JSON.stringify(body) });
    }

    // Detail response: inject the hostile summary.
    body.data.insights = HOSTILE_MARKDOWN;
    return route.fulfill({ response, body: JSON.stringify(body) });
  });

  await page.goto("/crm/opportunities");
  await page.waitForLoadState("networkidle");

  const firstRow = page.getByRole("link", { name: /./ }).first();
  test.skip(!(await firstRow.isVisible().catch(() => false)), "no opportunity to open");

  await page.goto(`/crm/opportunities/${opportunityId}`);
  await page.waitForLoadState("networkidle");

  // Markdown is rendered as real elements, not literal characters.
  await expect(page.getByText("**Important**", { exact: true })).toHaveCount(0);
  await expect(page.locator("strong", { hasText: "Important" }).first()).toBeVisible();
  await expect(page.locator("li", { hasText: "First item" }).first()).toBeVisible();

  // Raw HTML is escaped, never mounted as live nodes.
  await expect(page.locator("script:has-text('xss')")).toHaveCount(0);
  await expect(page.locator("img[onerror]")).toHaveCount(0);

  // Safe links keep a hardened rel; unsafe protocols never survive as hrefs.
  const safeLink = page.locator('a[href="https://example.com"]').first();
  await expect(safeLink).toHaveAttribute("rel", /noopener/);
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);

  expect(alerts, "injected script executed").toEqual([]);
});
