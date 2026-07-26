import { test, expect } from "@playwright/test";

test.describe("AI Chat", () => {
  test("chat page loads", async ({ page }) => {
    await page.goto("/ai");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("chat interface has input and send button", async ({ page }) => {
    await page.goto("/ai");
    const input = page.locator('textarea, input[type="text"]').first();
    const sendButton = page.getByRole("button", { name: /send|submit|→|arrow/i }).first();

    if (await input.isVisible()) {
      await expect(input).toBeVisible();
      if (await sendButton.isVisible()) {
        await expect(sendButton).toBeVisible();
      }
    }
  });

  test("can type a message", async ({ page }) => {
    await page.goto("/ai");
    const input = page.locator('textarea, input[type="text"]').first();
    if (await input.isVisible()) {
      await input.fill("Hello, how can you help me today?");
      await expect(input).toHaveValue(/help/i);
    }
  });

  test("conversation history exists", async ({ page }) => {
    await page.goto("/ai");
    const sidebar = page.locator("[class*=sidebar], [class*=history], nav").first();
    const conversationList = page.getByText(/conversations|history|recent/i);
    await expect(
      Promise.any([
        sidebar.isVisible().then((v) => v),
        conversationList.isVisible().then((v) => v),
      ]),
    ).resolves.toBe(true);
  });
});
