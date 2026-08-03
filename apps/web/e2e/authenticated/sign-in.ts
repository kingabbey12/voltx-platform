import { expect, type Browser, type Page } from "@playwright/test";

/** Test-only credential shared with backend/prisma/seed-e2e-fixtures.ts. */
export const E2E_FIXTURE_PASSWORD =
  process.env.E2E_FIXTURE_PASSWORD ?? "e2e-Runner-Password-1";

/**
 * The owner identity is provisioned by the environment (registration), not by
 * the fixture seeder, so it carries its own password. Every other identity is
 * a seeded fixture. Resolving this per-email keeps call sites from having to
 * know which is which.
 */
function passwordFor(email: string): string {
  const ownerEmail = process.env.E2E_USER_EMAIL;
  const ownerPassword = process.env.E2E_USER_PASSWORD;
  if (ownerEmail && ownerPassword && email.toLowerCase() === ownerEmail.toLowerCase()) {
    return ownerPassword;
  }
  return E2E_FIXTURE_PASSWORD;
}

/**
 * Signs in as a specific identity and **fails closed**.
 *
 * The previous helper only polled for an access token and then asserted the
 * Executive heading. If the requested user did not exist, or the login was
 * rejected, anything that left a usable session behind — a token from an
 * earlier context, a redirect that landed on an authenticated page — let the
 * test proceed as somebody else. A permission matrix that silently re-verifies
 * the owner passes while proving nothing, which is worse than no test.
 *
 * So this asserts the resolved session identity equals the requested email
 * before returning. A missing fixture now fails loudly, naming the user.
 */
export async function signInAs(
  browser: Browser,
  email: string,
  options: { landingPath?: string; landingHeading?: string } = {},
): Promise<{ context: Awaited<ReturnType<Browser["newContext"]>>; page: Page }> {
  const landingPath = options.landingPath ?? "/executive";
  // A clean context: never inherit a storage state that could satisfy the
  // session checks below on behalf of a different user.
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(passwordFor(email));
  await page.getByRole("button", { name: /sign in|log in|continue/i }).click();

  const authenticated = await page
    .waitForFunction(() => Boolean(window.localStorage.getItem("voltx.accessToken")), null, {
      timeout: 20_000,
    })
    .then(() => true)
    .catch(() => false);

  if (!authenticated) {
    const visibleError = await page
      .getByRole("alert")
      .first()
      .textContent()
      .catch(() => null);
    await context.close();
    throw new Error(
      `signInAs("${email}") failed: no session was established. ` +
        `The fixture user probably does not exist — provision it with ` +
        `backend/prisma/seed-e2e-fixtures.ts. Page error: ${visibleError ?? "none"}`,
    );
  }

  // The identity actually granted must be the one requested. This is the
  // assertion that turns a fail-open helper into a fail-closed one.
  const resolved = await resolveSessionEmail(page, apiBaseUrl());
  if (resolved?.toLowerCase() !== email.toLowerCase()) {
    await context.close();
    throw new Error(
      `signInAs("${email}") resolved to a different identity ("${resolved ?? "unknown"}"). ` +
        `Refusing to continue — a permission test run as the wrong user proves nothing.`,
    );
  }

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await page.goto(landingPath);
  await expect(page).not.toHaveURL(/\/login|\/onboarding/);
  if (options.landingHeading) {
    await expect(
      page.getByRole("heading", { level: 1, name: options.landingHeading }),
    ).toBeVisible();
  }

  return { context, page };
}

/**
 * Reads the signed-in user's email from the API rather than the DOM, so the
 * check does not depend on whether any particular page renders it.
 */
/**
 * The API lives on a different origin from the Next server during tests, so a
 * relative path would resolve against the web app and never reach it.
 */
function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3010/api/v1";
}

async function resolveSessionEmail(page: Page, base: string): Promise<string | null> {
  return page.evaluate(async (apiBase: string) => {
    const token = window.localStorage.getItem("voltx.accessToken");
    if (!token) return null;
    for (const path of [`${apiBase}/auth/me`, `${apiBase}/users/me`]) {
      try {
        const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) continue;
        const body: unknown = await response.json();
        const data = (body as { data?: Record<string, unknown> }).data ?? body;
        const email = (data as { email?: unknown }).email;
        if (typeof email === "string") return email;
      } catch {
        // Try the next candidate path.
      }
    }
    // No email claim exists on the token, so there is no safe fallback: if no
    // profile endpoint answered, the identity is genuinely unknown and the
    // caller must refuse to continue.
    return null;
  }, base);
}
