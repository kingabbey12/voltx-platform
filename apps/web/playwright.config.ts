import { defineConfig, devices } from "@playwright/test";
import { AUTH_STATE } from "./e2e/auth-state";

const chromeLaunchOptions = { args: ["--no-sandbox", "--disable-setuid-sandbox"] };

// One source of truth for where the app under test lives. `use.baseURL` and
// `webServer` used to disagree: baseURL honoured PLAYWRIGHT_BASE_URL while
// webServer hard-coded 3000, so overriding one moved the tests but not the
// server. Worse, `next dev` falls back to the next free port when 3000 is
// taken, while Playwright kept waiting on 3000 until it timed out after two
// minutes — a confusing failure that says nothing about the actual cause.
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL,
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Runs without a session. Everything here must be reachable by a logged-out
    // visitor, so it needs no API and stays in the fast `web` CI job.
    {
      name: "public",
      testDir: "./e2e/public",
      use: { ...devices["Desktop Chrome"], launchOptions: chromeLaunchOptions },
    },
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"], launchOptions: chromeLaunchOptions },
    },
    // Requires a real API and a real login — see e2e/auth.setup.ts. Run by the
    // `web-e2e-authenticated` CI job, which stands up Postgres and the backend
    // first. Kept as its own project rather than merged into `public` so that
    // running the fast job cannot silently produce vacuous passes against a
    // redirected login page.
    {
      name: "authenticated",
      testDir: "./e2e/authenticated",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: AUTH_STATE,
        launchOptions: chromeLaunchOptions,
      },
    },
  ],
  webServer: {
    // Pinned to the same port Playwright then waits on, so `next dev`'s
    // "port in use, using another one instead" fallback can never silently
    // desynchronise the two.
    command: `pnpm dev --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
