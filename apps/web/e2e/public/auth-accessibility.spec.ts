import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility contract for the (auth) route group.
 *
 * These pages render outside the app shell, so they own their landmark and
 * heading outright. They previously had neither: no <main> meant no skip
 * target, and a styled CardTitle div meant screen readers announced no page
 * heading at all — on the first three pages every user meets.
 *
 * Axe is a floor, not a ceiling. `landmark-one-main` and `page-has-heading-one`
 * are best-practice rules that are off by default, which is exactly why the
 * regression survived a clean Axe run; the explicit counts below are the part
 * that actually holds the line.
 */

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x900", width: 1024, height: 900 },
  { name: "1440x1000", width: 1440, height: 1000 },
] as const;

const PAGES = [
  { path: "/login", heading: "Sign in" },
  { path: "/register", heading: "Create your account" },
  { path: "/forgot-password", heading: "Reset your password" },
] as const;

async function blockingViolations(page: import("@playwright/test").Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations
    .filter((violation) => violation.impact === "critical" || violation.impact === "serious")
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.nodes
          .map((node) => node.target.join(" "))
          .join(" | ")}`,
    );
}

for (const authPage of PAGES) {
  test(`${authPage.path} exposes one main landmark and one h1`, async ({ page }) => {
    await page.goto(authPage.path);

    await expect(page.locator("main")).toHaveCount(1);
    await expect(page.locator('[role="main"]')).toHaveCount(0);

    const h1 = page.locator("h1");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(authPage.heading);
  });

  for (const viewport of VIEWPORTS) {
    test(`${authPage.path} @ ${viewport.name} — no overflow, no blocking a11y violations`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(authPage.path);

      // A sideways scrollbar on a login form is a layout bug on small screens.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow of ${overflow}px`).toBeLessThanOrEqual(0);

      expect(await blockingViolations(page)).toEqual([]);
    });
  }
}

test("login is keyboard reachable with visible focus", async ({ page }) => {
  await page.goto("/login");
  await page.keyboard.press("Tab");

  const focus = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return {
      tag: el.tagName,
      // Either a real outline or a ring shadow counts; the theme uses both.
      visible: style.outlineStyle !== "none" || style.boxShadow !== "none",
    };
  });

  expect(focus, "Tab moved focus nowhere").not.toBeNull();
  expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(focus!.tag);
  expect(focus!.visible, "focused element has no visible focus indicator").toBe(true);
});
