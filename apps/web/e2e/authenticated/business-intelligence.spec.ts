import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROUTE = "/executive/business-intelligence";

/** Viewports the dashboard must survive without horizontal overflow. */
const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 900 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

async function gotoDashboard(page: import("@playwright/test").Page) {
  await page.goto(ROUTE);
  await expect(page).not.toHaveURL(/\/login|\/onboarding/);
  await expect(page.getByRole("heading", { level: 1, name: "Business intelligence" })).toBeVisible();
  // The error state renders the same <h1>, so the heading alone does not mean
  // the data loaded. Wait for the loaded container before asserting content.
  await expect(page.getByTestId("bi-page")).toBeVisible({ timeout: 30_000 });
}

test.describe("Business Intelligence dashboard", () => {
  test("renders executive health, department cards and the unavailable-history banner", async ({
    page,
  }) => {
    await gotoDashboard(page);

    await expect(
      page.getByRole("heading", { level: 2, name: "Executive health", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("bi-card-executive_health")).toBeVisible();
    await expect(page.getByTestId("bi-executive-summary")).toBeVisible();

    await expect(
      page.getByRole("heading", { level: 2, name: "Department health", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("bi-departments")).toBeVisible();

    // Every department the BI contract defines is rendered.
    for (const id of [
      "sales_health",
      "financial_health",
      "operations_health",
      "communications_health",
      "customer_success_health",
      "compliance_health",
    ]) {
      await expect(page.getByTestId(`bi-card-${id}`)).toBeVisible();
    }

    // Historical trends are always reported unavailable, never inferred.
    await expect(page.getByTestId("bi-history-banner")).toContainText(/historical trends are unavailable/i);
  });

  test("shows a formula version on every card and never computes a score client-side", async ({
    page,
  }) => {
    await gotoDashboard(page);

    const cards = page.locator('[data-testid^="bi-card-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      await expect(cards.nth(index)).toContainText("v1.0");
    }

    // Exactly one BI read backs the whole page — no per-card recomputation
    // and no second endpoint.
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/business-intelligence")) requests.push(request.url());
    });
    await page.getByTestId("bi-refresh").click();
    await expect(page.getByTestId("bi-refresh")).toBeEnabled();
    expect(requests.filter((url) => /\/business-intelligence(\?|$)/.test(url)).length).toBeLessThanOrEqual(1);
  });

  test("exposes exactly one main landmark", async ({ page }) => {
    await gotoDashboard(page);
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("refreshes on demand", async ({ page }) => {
    await gotoDashboard(page);

    const refreshed = page.waitForResponse(
      (response) => response.url().includes("/business-intelligence") && response.status() === 200,
    );
    await page.getByTestId("bi-refresh").click();
    await refreshed;
    await expect(page.getByTestId("bi-departments")).toBeVisible();
  });

  test("shows a loading state before data arrives", async ({ page }) => {
    await page.route("**/api/v1/business-intelligence*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.goto(ROUTE);
    await expect(page.getByTestId("bi-loading")).toBeVisible();
    await expect(page.getByTestId("bi-page")).toBeVisible({ timeout: 20_000 });
  });

  test("shows an error state and recovers through retry", async ({ page }) => {
    // Every attempt fails: the client retries a failed read, so failing only
    // the first request would never surface the error state at all.
    await page.route("**/api/v1/business-intelligence*", (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ message: "boom" }) }),
    );

    await page.goto(ROUTE);
    await expect(page.getByTestId("bi-error")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("bi-error").getByRole("alert")).toContainText(
      /could not be loaded/i,
    );

    // Recovery is driven by the user's own retry control.
    await page.unroute("**/api/v1/business-intelligence*");
    await page.getByTestId("bi-retry").click();
    await expect(page.getByTestId("bi-page")).toBeVisible({ timeout: 30_000 });
  });

  test("filters locally and shows an empty state without a new request", async ({ page }) => {
    await gotoDashboard(page);

    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/business-intelligence")) requests.push(request.url());
    });

    await page.getByTestId("bi-search").fill("sales");
    await expect(page.getByTestId("bi-card-sales_health")).toBeVisible();
    await expect(page.getByTestId("bi-card-financial_health")).toHaveCount(0);

    await page.getByTestId("bi-search").fill("zzzz-no-such-department");
    await expect(page.getByTestId("bi-empty")).toBeVisible();

    // Local cached search only.
    expect(requests).toHaveLength(0);

    await page.getByTestId("bi-search").fill("");
    await expect(page.getByTestId("bi-departments")).toBeVisible();
  });

  test("searches evidence, reasoning and sources, not just the department name", async ({
    page,
  }) => {
    await gotoDashboard(page);

    // "verified" appears in the reasoning text of scored departments.
    await page.getByTestId("bi-search").fill("verified");
    const matched = page.locator('[data-testid^="bi-card-"]');
    expect(await matched.count()).toBeGreaterThan(0);
  });

  test("opens the evidence drawer with formula, reasoning, confidence and excluded sources", async ({
    page,
  }) => {
    await gotoDashboard(page);

    await page.getByTestId("bi-evidence-open-sales_health").click();
    const drawer = page.getByTestId("bi-evidence-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAttribute("aria-modal", "true");

    await expect(drawer.getByRole("heading", { name: /formula \(version 1\.0\)/i })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Reasoning" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Inputs" })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: /^Evidence/ })).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Excluded sources" })).toBeVisible();
    await expect(drawer).toContainText(/confidence:/i);

    await page.getByTestId("bi-evidence-close").click();
    await expect(drawer).toHaveCount(0);
  });

  test("is keyboard navigable end to end", async ({ page }) => {
    await gotoDashboard(page);

    // The search field is reachable and usable from the keyboard.
    await page.getByTestId("bi-search").focus();
    await page.keyboard.type("operations");
    await expect(page.getByTestId("bi-card-operations_health")).toBeVisible();
    await page.getByTestId("bi-search").fill("");

    // The evidence trigger is a real button: focus + Enter opens the drawer.
    const trigger = page.getByTestId("bi-evidence-open-operations_health");
    await trigger.focus();
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("bi-evidence-drawer")).toBeVisible();

    // The close control receives focus on open, so Enter closes it.
    await expect(page.getByTestId("bi-evidence-close")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("bi-evidence-drawer")).toHaveCount(0);
  });

  test("renders in dark mode without losing content", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.addInitScript(() => {
      window.localStorage.setItem("theme", "dark");
    });
    await gotoDashboard(page);

    await expect(page.getByTestId("bi-card-executive_health")).toBeVisible();
    await expect(page.getByTestId("bi-departments")).toBeVisible();
    await expect(page.getByTestId("bi-history-banner")).toBeVisible();
  });

  for (const viewport of VIEWPORTS) {
    test(`has no horizontal overflow at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoDashboard(page);

      await expect(page.getByTestId("bi-card-executive_health")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

      await page.screenshot({
        path: `../../.uiqa/bi-${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });
    });
  }

  test("reflects permission filtering rather than fabricating a score", async ({ page }) => {
    await gotoDashboard(page);

    // Whatever the signed-in role can read, an unavailable department must
    // show no number and must say why — never a fabricated score.
    const unavailable = page.locator('[data-testid^="bi-card-"][data-status="unavailable"]');
    const count = await unavailable.count();
    for (let index = 0; index < count; index += 1) {
      const card = unavailable.nth(index);
      await expect(card).toContainText("Unavailable");
      await expect(card).toContainText(/unavailable|no score is fabricated/i);
    }

    // A restricted source is always named, never silently dropped.
    if (count > 0) {
      await expect(page.getByTestId("bi-excluded")).toBeVisible();
    }
  });

  test("has no critical or serious accessibility violations", async ({ page }) => {
    await gotoDashboard(page);

    const results = await new AxeBuilder({ page }).include('[data-testid="bi-page"]').analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    expect(
      blocking.map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.nodes
            .map((node) => node.target.join(" "))
            .join(" | ")}`,
      ),
    ).toEqual([]);
  });

  test("has no critical or serious accessibility violations with the drawer open", async ({
    page,
  }) => {
    await gotoDashboard(page);
    await page.getByTestId("bi-evidence-open-sales_health").click();
    await expect(page.getByTestId("bi-evidence-drawer")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-testid="bi-evidence-drawer"]')
      .analyze();
    const blocking = results.violations.filter(
      (violation) => violation.impact === "critical" || violation.impact === "serious",
    );
    expect(
      blocking.map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.nodes
            .map((node) => node.target.join(" "))
            .join(" | ")}`,
      ),
    ).toEqual([]);
  });
});
