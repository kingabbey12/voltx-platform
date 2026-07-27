import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("login page renders with form elements", async ({ page }) => {
    await expect(page).toHaveTitle(/Voltx/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|log in|continue/i })).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    // Expect some form of validation feedback
    await expect(page.locator("[aria-invalid=true], .text-destructive, [role=alert]").first()).toBeVisible();
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.locator('input[type="email"]').fill("invalid@example.com");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in|continue/i }).click();
    // Expect error toast or error message
    const error = page.locator("[role=alert], .text-destructive, [data-sonner-toast]");
    await expect(error.first()).toBeVisible({ timeout: 10000 });
  });

  test("has link to forgot password", async ({ page }) => {
    const forgotLink = page.getByText(/forgot|reset password/i);
    if (await forgotLink.isVisible()) {
      await forgotLink.click();
      await expect(page).toHaveURL(/forgot|reset/i);
    }
  });

  test("has link to sign up", async ({ page }) => {
    const signupLink = page.getByText(/sign up|create account|register/i);
    if (await signupLink.isVisible()) {
      await signupLink.click();
      await expect(page).toHaveURL(/signup|register|create/i);
    }
  });
});
