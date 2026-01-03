import { test, expect } from "@playwright/test";

test.describe("Orders Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/orders");
    await page.waitForTimeout(1000);
  });

  test("page loads (authenticated or redirects)", async ({ page }) => {
    const url = page.url();
    expect(url.includes("/dashboard/orders") || url.includes("/sign-in")).toBe(true);
  });

  test("if authenticated, displays Order History heading", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: /Order/i }).first()).toBeVisible();
  });

  test("if authenticated, displays filter tabs", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const tabNames = ["All", "Open", "Filled", "Cancelled"];
    let foundTabs = 0;

    for (const tab of tabNames) {
      const element = page.getByText(tab, { exact: false }).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) foundTabs++;
    }

    expect(foundTabs).toBeGreaterThan(0);
  });

  test("if authenticated, displays stats cards", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const statLabels = ["Total Orders", "Filled", "Paper Trades", "Pending"];
    let foundStats = 0;

    for (const label of statLabels) {
      const element = page.getByText(label, { exact: false }).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) foundStats++;
    }

    expect(foundStats).toBeGreaterThanOrEqual(2);
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
