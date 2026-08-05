import { expect, test } from "@playwright/test";

function envelope<T>(data: T) {
  return {
    success: true,
    data,
    meta: {
      requestId: "promise-cache-test",
      timestamp: "2026-08-05T00:00:00.000Z",
      version: "1",
    },
  };
}

test("a successful promise appears before the background refetch completes", async ({ page }) => {
  let listRequests = 0;
  const created = {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Contract promise",
    status: "PROPOSED",
    ownerId: "33333333-3333-4333-8333-333333333333",
    dueAt: null,
    parties: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        role: "OBLIGEE",
        contactId: "55555555-5555-4555-8555-555555555555",
        userId: null,
      },
    ],
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };

  await page.route(/\/api\/v1\/promises(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ json: envelope(created) });
      return;
    }

    listRequests += 1;
    if (listRequests > 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    await route.fulfill({
      json: envelope({ items: [], total: 0, page: 1, limit: 200, totalPages: 0 }),
    });
  });
  await page.route(/\/api\/v1\/sales\/contacts(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: envelope({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            firstName: "Maya",
            lastName: "Chen",
          },
        ],
        total: 1,
        page: 1,
        limit: 100,
        totalPages: 1,
      }),
    }),
  );

  await page.goto("/promises");
  await page.getByRole("button", { name: "Propose a promise" }).first().click();
  await page.getByRole("textbox", { name: "Title" }).fill(created.title);
  await page.getByRole("combobox", { name: "Who is the company promising?" }).click();
  await page.getByRole("option", { name: "Maya Chen" }).click();
  await page.getByRole("button", { name: "Propose", exact: true }).click();

  await expect(page.getByText("1 commitments")).toBeVisible();
  await expect(page.getByText(created.title, { exact: true })).toBeVisible();
});
