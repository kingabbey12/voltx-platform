import { test as setup, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AUTH_STATE } from "./auth-state";

/**
 * Signs in once and saves the browser storage state for the `authenticated`
 * project to reuse, so the 23 specs under e2e/authenticated/ do not each pay
 * for a login.
 *
 * This exists because those specs never had a session. Every route under
 * src/app/(app)/ is guarded twice: middleware.ts redirects when the `session`
 * cookie is absent, and (app)/layout.tsx redirects again from useAuthStore
 * when the client cannot resolve a user. The second guard is why simply
 * injecting a cookie is not enough — the store resolves its user from the API,
 * so a real backend and a real login are required.
 *
 * Credentials come from the environment and are created by the CI job against
 * a throwaway database. There is no fallback: a missing value must fail loudly
 * here rather than silently produce an unauthenticated state file that makes
 * every dependent spec fail with a confusing redirect.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL and E2E_USER_PASSWORD must be set to run the authenticated e2e project. " +
        "The CI job creates this user via POST /auth/register before invoking Playwright.",
    );
  }

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).click();

  await expect
    .poll(() => page.evaluate(() => Boolean(window.localStorage.getItem("voltx.accessToken"))))
    .toBe(true);
  await page.goto("/dashboard");

  // Landing anywhere outside /login means both guards let us through. Asserting
  // on a specific dashboard element would couple this to that page's markup.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  if (!existsSync(dirname(AUTH_STATE))) {
    mkdirSync(dirname(AUTH_STATE), { recursive: true });
  }

  await page.context().storageState({ path: AUTH_STATE });
});
