import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Captures authenticated pages so design-system changes can actually be looked
 * at. Not assertions — this is a review aid. It runs in its own `screenshots`
 * project so it never gates CI.
 *
 * Run it via scripts/dev-authenticated-env.sh, which supplies the API, a seeded
 * database and a user whose onboarding is complete. Without that last part
 * every route redirects into the onboarding wizard and you screenshot the wrong
 * thing entirely.
 */

const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "crm-companies", path: "/crm/companies" },
  { name: "crm-leads", path: "/crm/leads" },
  { name: "workflows", path: "/workflows" },
  { name: "settings", path: "/settings" },
];

/**
 * Heights are deliberately taller than a real display.
 *
 * `fullPage: true` measures the document's scroll height, but DashboardShell
 * pins the document to h-svh and scrolls an inner <main> instead — so Playwright
 * saw a 900px page and silently cropped everything below the fold. Capturing at
 * an over-tall viewport is what actually reveals the whole page.
 */
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 2200 },
  { name: "mobile", width: 390, height: 2200 },
];

/**
 * framer-motion drives entrance animations with requestAnimationFrame, which
 * does not tick while a tab is backgrounded — elements then sit at their
 * `initial` opacity and the capture comes back blank. Waiting for the network
 * to settle is not enough; wait until the animated content has actually
 * committed to its final opacity.
 */
async function waitForMotionToSettle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("main [style*='opacity']")].every(
          (el) => Number(getComputedStyle(el).opacity) > 0.99,
        ),
      undefined,
      { timeout: 5_000 },
    )
    .catch(() => {
      // Some pages have no motion wrappers at all — not a failure.
    });
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const target of PAGES) {
      test(`${target.name}`, async ({ page }) => {
        await page.goto(target.path);

        // Confirms the auth guard actually let us through. If this fails the
        // session is wrong and every screenshot below would be the login page.
        await expect(page).not.toHaveURL(/\/login|\/onboarding/, { timeout: 20_000 });

        await waitForMotionToSettle(page);
        await page.screenshot({
          path: `${OUT}/${target.name}-${viewport.name}.png`,
          fullPage: true,
        });
      });
    }
  });
}
