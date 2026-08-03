import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { signInAs } from "./sign-in";

test.describe("Executive Command Center", () => {
  test("renders the permitted executive workspace and preserves approval safety", async ({ page }) => {
    await page.goto("/executive");
    await expect(page).not.toHaveURL(/\/login|\/onboarding/);
    await expect(page.getByRole("heading", { level: 1, name: "Executive Command Center" })).toBeVisible();
    for (const name of ["Executive Summary", "Decision Center", "Workflow Queue", "Risk Center", "Department Overview", "Pending Approvals", "Opportunity Center", "Executive Timeline"]) {
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByLabel("Search Command Center")).toBeVisible();
    await expect(page.getByText(/approval required/i).first()).toBeVisible();
    await expect(page.getByText(/execute now/i)).toHaveCount(0);
  });

  test("exposes exactly one main landmark", async ({ page }) => {
    await page.goto("/executive");
    await expect(page.getByRole("heading", { level: 1, name: "Executive Command Center" })).toBeVisible();
    // The app shell owns the page-level <main>; a page nesting its own creates
    // a second landmark, which is both an a11y defect and what made
    // `locator("main")` ambiguous for every assertion in this file.
    await expect(page.locator("main")).toHaveCount(1);
  });

  test("keeps the layout within the mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/executive");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test("opens the shared command palette with the documented shortcut", async ({ page }) => {
    await page.goto("/executive");
    // Clicking the real shell control establishes that the hydrated command
    // palette is interactive before we assert its global keyboard shortcut.
    await page.getByRole("button", { name: /search.*⌘k/i }).click();
    await expect(page.getByPlaceholder("Search your operating system...")).toBeFocused();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder("Search your operating system...")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByPlaceholder("Search your operating system...")).toHaveCount(0);
  });

  test("keeps search local and requests each initial executive source once", async ({ page }) => {
    const sourcePaths = ["/ai/insights", "/ai/decisions", "/ai/workflow-plans", "/workflows/approvals", "/sales/opportunities"];
    const requestCounts = new Map(sourcePaths.map((path) => [path, 0]));
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname.replace("/api/v1", "");
      if (request.method() === "GET" && requestCounts.has(path)) {
        requestCounts.set(path, (requestCounts.get(path) ?? 0) + 1);
      }
    });

    await page.goto("/executive");
    await expect(page.getByRole("heading", { level: 1, name: "Executive Command Center" })).toBeVisible();
    await expect.poll(() => [...requestCounts.values()].every((count) => count === 1)).toBe(true);

    const totalBeforeSearch = [...requestCounts.values()].reduce((total, count) => total + count, 0);
    await page.getByLabel("Search Command Center").fill("highest");
    await expect(page.getByRole("listbox", { name: "Command Center search results" })).toBeVisible();
    await page.waitForTimeout(300);
    expect([...requestCounts.values()].reduce((total, count) => total + count, 0)).toBe(totalBeforeSearch);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox", { name: "Command Center search results" })).toHaveCount(0);
  });

  test("isolates a failed section and retries only that endpoint", async ({ page }) => {
    let insightRequests = 0;
    await page.route("**/api/v1/ai/insights", async (route) => {
      insightRequests += 1;
      if (insightRequests === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false, message: "Temporary test failure" }) });
        return;
      }
      await route.continue();
    });

    await page.goto("/executive");
    const summary = page.getByRole("region", { name: "Executive Summary" });
    await expect(summary.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("region", { name: "Decision Center" })).toBeVisible();
    await summary.getByRole("button", { name: "Retry Executive Summary" }).click();
    await expect(summary.getByRole("alert")).toHaveCount(0);
    await expect.poll(() => insightRequests).toBe(2);
  });

  test("captures responsive Command Center artifacts without overflow", async ({ page }, testInfo) => {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 1024, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/executive");
      await expect(page.getByRole("heading", { level: 1, name: "Executive Command Center" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`executive-${viewport.width}x${viewport.height}.png`), fullPage: true });
    }
  });

  test("has no serious or critical automated accessibility violations", async ({ page }) => {
    const audit = async (selector = "[data-executive-command-center]") => {
      const results = await new AxeBuilder({ page }).include(selector).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")).toEqual([]);
    };

    await page.goto("/executive");
    await expect(page.getByRole("heading", { level: 1, name: "Executive Command Center" })).toBeVisible();
    await audit();

    await page.getByLabel("Search Command Center").fill("highest");
    await expect(page.getByRole("listbox", { name: "Command Center search results" })).toBeVisible();
    await audit();

    await page.getByRole("button", { name: /search.*⌘k/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit('[role="dialog"]');
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/executive");
    await audit();

    let intercepted = false;
    await page.route("**/api/v1/ai/insights", async (route) => {
      if (!intercepted) {
        intercepted = true;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ success: false }) });
        return;
      }
      await route.continue();
    });
    await page.goto("/executive");
    await expect(page.getByRole("region", { name: "Executive Summary" }).getByRole("alert")).toBeVisible();
    await audit();
  });

  test("enforces the executive browser permission matrix", async ({ browser }) => {
    const cases = [
      {
        name: "owner",
        email: process.env.E2E_USER_EMAIL!,
        verify: async (page: Awaited<ReturnType<typeof signInAs>>["page"]) => {
          await expect(page.getByRole("region", { name: "Opportunity Center" }).getByRole("alert")).toHaveCount(0);
          await expect(page.getByRole("region", { name: "Pending Approvals" }).getByRole("alert")).toHaveCount(0);
          await page.getByRole("button", { name: /search.*⌘k/i }).click();
          await expect(page.getByRole("dialog").getByText("Executive", { exact: true })).toBeVisible();
          await expect(page.getByRole("dialog").getByText("Finance", { exact: true })).toBeVisible();
        },
      },
      {
        name: "CRM-limited",
        email: "e2e-executive-crm@local.voltx.test",
        verify: async (page: Awaited<ReturnType<typeof signInAs>>["page"]) => {
          await expect(page.getByRole("region", { name: "Opportunity Center" }).getByRole("alert")).toHaveCount(0);
          await page.getByRole("button", { name: /search.*⌘k/i }).click();
          await expect(page.getByRole("dialog").getByText("Finance", { exact: true })).toHaveCount(0);
          await expect(page.getByRole("dialog").getByText("Opportunities", { exact: true })).toBeVisible();
        },
      },
      {
        name: "Finance-limited",
        email: "e2e-executive-finance@local.voltx.test",
        verify: async (page: Awaited<ReturnType<typeof signInAs>>["page"]) => {
          await expect(page.getByRole("region", { name: "Opportunity Center" }).getByRole("alert")).toBeVisible();
          await expect(page.locator("body")).not.toContainText("e2e-executive-crm@local.voltx.test");
          await page.getByRole("button", { name: /search.*⌘k/i }).click();
          await expect(page.getByRole("dialog").getByText("CRM", { exact: true })).toHaveCount(0);
          await expect(page.getByRole("dialog").getByText("Opportunities", { exact: true })).toHaveCount(0);
          await expect(page.getByRole("dialog").getByText("Finance", { exact: true })).toBeVisible();
        },
      },
      {
        name: "approval-restricted",
        email: "e2e-executive-approval@local.voltx.test",
        verify: async (page: Awaited<ReturnType<typeof signInAs>>["page"]) => {
          await expect(page.getByRole("region", { name: "Pending Approvals" }).getByRole("alert")).toBeVisible();
          await expect(page.getByRole("region", { name: "Pending Approvals" })).not.toContainText(/Approval [0-9a-f-]{8}/i);
          await expect(page.getByText(/execute now/i)).toHaveCount(0);
        },
      },
    ];

    for (const role of cases) {
      const { context, page } = await signInAs(browser, role.email, {
        landingPath: "/executive",
        landingHeading: "Executive Command Center",
      });
      await role.verify(page);
      await context.close();
    }
  });
});
