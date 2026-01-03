import { test, expect } from "@playwright/test";

test.describe("Settings Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/settings");
    await page.waitForTimeout(1000);
  });

  test("page loads (authenticated or redirects)", async ({ page }) => {
    const url = page.url();
    expect(url.includes("/dashboard/settings") || url.includes("/sign-in")).toBe(true);
  });

  test("if authenticated, displays Settings heading", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: /Setting/i }).first()).toBeVisible();
  });

  test("if authenticated, displays trading preferences", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const prefText = page.getByText(/Trading|Preference|Mode/i).first();
    await expect(prefText).toBeVisible();
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
