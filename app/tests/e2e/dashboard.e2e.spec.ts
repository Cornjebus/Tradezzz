import { test, expect } from "@playwright/test";

/**
 * Dashboard E2E Tests
 *
 * These tests verify the main dashboard functionality.
 * Note: Tests gracefully handle unauthenticated state by checking
 * if redirected to sign-in page.
 */

test.describe("Main Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    // Wait for page to settle
    await page.waitForTimeout(1000);
  });

  test("page loads (authenticated or redirects to sign-in)", async ({ page }) => {
    const url = page.url();

    // Either on dashboard or redirected to sign-in
    const onDashboard = url.includes("/dashboard");
    const onSignIn = url.includes("/sign-in");

    expect(onDashboard || onSignIn).toBe(true);
  });

  test("if authenticated, shows dashboard content", async ({ page }) => {
    const url = page.url();

    // Skip if on sign-in page
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    // Check for TradeZZZ branding
    const branding = page.getByText(/Trade.*ZZZ/i).first();
    await expect(branding).toBeVisible({ timeout: 5000 });
  });

  test("if authenticated, shows Neural Assistant section", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    await expect(page.getByText("Neural Assistant")).toBeVisible();
  });

  test("if authenticated, displays trading mode indicator", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const tradingMode = page.getByText(/Paper Trading|Live Trading/i).first();
    await expect(tradingMode).toBeVisible();
  });

  test("no 500 errors on background API calls", async ({ page }) => {
    const responses: import("@playwright/test").APIResponse[] = [];

    page.on("response", (response) => {
      responses.push(response as any);
    });

    await page.reload();
    await page.waitForTimeout(2000);

    const errorResponses = responses.filter((r) => {
      const url = r.url();
      const status = r.status();
      // Only check for 500+ errors on API routes
      return url.includes("/api/") && status >= 500;
    });

    expect(
      errorResponses.map((r) => `${r.status()} ${r.url()}`),
    ).toEqual([]);
  });

  test("sign-in page loads correctly when not authenticated", async ({ page }) => {
    const url = page.url();

    if (url.includes("/sign-in")) {
      // Verify sign-in page has Clerk elements
      const signInForm = page.locator('[class*="cl-"], form').first();
      await expect(signInForm).toBeVisible({ timeout: 5000 });
    }
  });
});
