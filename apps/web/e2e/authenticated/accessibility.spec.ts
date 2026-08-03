import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility sweep across the release surfaces.
 *
 * Axe is a floor, not a ceiling: passing it does not establish WCAG
 * conformance, only that no automatically-detectable critical or serious
 * violation is present. Manual keyboard and screen-reader review is still
 * required before claiming compliance.
 */

/** Every route the shell renders — each must expose exactly one landmark. */
const SHELL_ROUTES = [
  { path: "/executive", name: "Executive Command Center" },
  { path: "/executive/business-intelligence", name: "Business Intelligence" },
  { path: "/executive-insights", name: "Executive Insights" },
  { path: "/executive-decisions", name: "Executive Decisions" },
  { path: "/multi-agent", name: "Multi-Agent" },
  { path: "/workflow-plans", name: "Workflow Plans" },
  { path: "/workflows/approvals", name: "Pending Approvals" },
] as const;

async function blockingViolations(page: import("@playwright/test").Page, selector?: string) {
  const builder = new AxeBuilder({ page });
  const results = await (selector ? builder.include(selector) : builder).analyze();
  return results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(" | ")}`,
    );
}

test.describe("Accessibility", () => {
  for (const route of SHELL_ROUTES) {
    test(`${route.name} exposes exactly one main landmark`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).not.toHaveURL(/\/login|\/onboarding/);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      // The shell owns the page-level <main>. A page rendering its own nests a
      // second landmark inside it, which breaks landmark navigation and makes
      // every `locator("main")` in the suite ambiguous.
      await expect(page.locator("main")).toHaveCount(1);
    });

    test(`${route.name} has no critical or serious violations`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).not.toHaveURL(/\/login|\/onboarding/);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      expect(await blockingViolations(page, "main")).toEqual([]);
    });
  }

  test("command palette has no critical or serious violations", async ({ page }) => {
    await page.goto("/executive");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByRole("button", { name: /search.*⌘k/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    expect(await blockingViolations(page, '[role="dialog"]')).toEqual([]);
  });

  test("mobile layout has no critical or serious violations", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/executive");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
    // No horizontal overflow at the narrowest supported width.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
});
