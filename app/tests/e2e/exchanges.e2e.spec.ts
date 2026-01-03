import { test, expect } from "@playwright/test";

test.describe("Exchanges Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/exchanges");
    await page.waitForTimeout(1000);
  });

  test("page loads (authenticated or redirects)", async ({ page }) => {
    const url = page.url();
    expect(url.includes("/dashboard/exchanges") || url.includes("/sign-in")).toBe(true);
  });

  test("if authenticated, displays exchange heading", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: /Exchange/i }).first()).toBeVisible();
  });

  test("if authenticated, displays available exchange options", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const exchangeNames = ["Coinbase", "Binance", "Kraken"];
    let foundExchanges = 0;

    for (const exchange of exchangeNames) {
      const element = page.getByText(exchange, { exact: false }).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) foundExchanges++;
    }

    expect(foundExchanges).toBeGreaterThan(0);
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
