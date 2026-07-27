/**
 * Where auth.setup.ts writes the signed-in browser state and where the
 * `authenticated` Playwright project reads it back.
 *
 * Deliberately its own module: playwright.config.ts needs this value, and
 * importing it from auth.setup.ts would make the config loader evaluate that
 * file's `setup(...)` call, which Playwright rejects with "did not expect
 * test() to be called here".
 *
 * Gitignored at runtime (apps/web/.gitignore) — the file holds a live session.
 */
export const AUTH_STATE = "e2e/.auth/user.json";
