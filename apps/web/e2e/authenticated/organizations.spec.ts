import { test, expect } from "@playwright/test";

/**
 * These specs originally navigated to /organizations and asserted a list or a
 * create prompt. Two things were wrong with that:
 *
 *  1. /organizations does not exist — it rendered the not-found page, so the
 *     assertions were describing a 404.
 *  2. The real route, /platform/organizations, is the Platform Console. It is
 *     gated on `isPlatformAdmin` (src/app/(app)/(shell)/platform/layout.tsx)
 *     and every endpoint behind it is guarded server-side by
 *     PLATFORM_ADMIN_GUARDS. It is Voltx staff tooling, not something an
 *     organization owner ever sees.
 *
 * The e2e account is an ordinary organization Owner, so what is actually
 * verifiable here is the guard: a non-platform-admin must not reach the
 * console. That is asserted below.
 *
 * Organization management from an owner's perspective lives under /settings
 * (team, roles, profile) and is covered by settings.spec.ts. Covering the
 * Platform Console's own content needs a platform-admin fixture, which does
 * not exist yet — see the remediation report.
 */
test.describe("Platform Console access control", () => {
  test("an ordinary owner is redirected away from the platform console", async ({ page }) => {
    await page.goto("/platform/organizations");

    // The layout redirects to /dashboard rather than rendering staff UI.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });

  test("no platform-admin organization tooling is rendered to an owner", async ({ page }) => {
    await page.goto("/platform/organizations");
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // Nothing from the console should leak into the page the user lands on.
    await expect(page.getByRole("heading", { name: /platform|all organizations/i })).toHaveCount(0);
  });
});
