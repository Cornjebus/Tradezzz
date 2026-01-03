import { test, expect } from "@playwright/test";

test.describe("Patterns Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/patterns");
    await page.waitForTimeout(1000);
  });

  test("page loads (authenticated or redirects)", async ({ page }) => {
    const url = page.url();
    expect(url.includes("/dashboard/patterns") || url.includes("/sign-in")).toBe(true);
  });

  test("if authenticated, displays Pattern Intelligence heading", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: /Pattern Intelligence/i }).first()).toBeVisible();
  });

  test("if authenticated, displays RuVector status", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const statusText = page.getByText(/RuVector|Pattern Engine/i).first();
    await expect(statusText).toBeVisible();
  });

  test("if authenticated, displays regime section", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const regimeText = page.getByText(/Market Regime|Regime/i).first();
    await expect(regimeText).toBeVisible();
  });

  test("if authenticated, displays strategy recommendations", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const recsText = page.getByText(/Recommend/i).first();
    await expect(recsText).toBeVisible();
  });

  test("no 500 errors on pattern API calls", async ({ page }) => {
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
