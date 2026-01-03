import { test, expect } from "@playwright/test";

test.describe("Strategies Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/strategies");
    await page.waitForTimeout(1000);
  });

  test("page loads (authenticated or redirects)", async ({ page }) => {
    const url = page.url();
    expect(url.includes("/dashboard/strategies") || url.includes("/sign-in")).toBe(true);
  });

  test("if authenticated, displays Trading Strategies heading", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: /Trading Strategies/i })).toBeVisible();
  });

  test("if authenticated, displays create strategy button", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const createButton = page.getByRole("button", { name: /Create|New|Add/i }).first();
    await expect(createButton).toBeVisible();
  });

  test("if authenticated, shows strategy list or empty state", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const strategyCard = page.locator('[class*="card"]').first();
    const emptyState = page.getByText(/No strategies|Create your first/i).first();

    const hasStrategies = await strategyCard.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasStrategies || hasEmpty).toBe(true);
  });

  test("no 500 errors on API calls", async ({ page }) => {
    const responses: import("@playwright/test").APIResponse[] = [];

    page.on("response", (response) => {
      responses.push(response as any);
    });

    await page.reload();
    await page.waitForTimeout(2000);

    const errorResponses = responses.filter((r) => {
      const url = r.url();
      return url.includes("/api/") && r.status() >= 500;
    });

    expect(
      errorResponses.map((r) => `${r.status()} ${r.url()}`),
    ).toEqual([]);
  });
});
