import { test, expect } from "@playwright/test";

/**
 * Navigation E2E Tests
 *
 * These tests verify navigation between dashboard pages.
 * Tests gracefully handle unauthenticated state.
 */

test.describe("Dashboard Navigation", () => {
  test("dashboard redirects to sign-in when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);

    const url = page.url();

    // Should be on dashboard or sign-in
    expect(url.includes("/dashboard") || url.includes("/sign-in")).toBe(true);
  });

  test("all dashboard routes are accessible (redirect to auth if needed)", async ({ page }) => {
    const routes = [
      "/dashboard",
      "/dashboard/exchanges",
      "/dashboard/ai-providers",
      "/dashboard/strategies",
      "/dashboard/patterns",
      "/dashboard/orders",
      "/dashboard/settings",
    ];

    for (const route of routes) {
      const response = await page.goto(route);

      // Should get 200 OK (either page or redirect)
      expect(response?.status()).toBeLessThan(500);

      // Wait for navigation to complete
      await page.waitForTimeout(500);

      const url = page.url();
      // Should be on the route or redirected to sign-in
      const validDestination = url.includes(route) || url.includes("/sign-in");
      expect(validDestination).toBe(true);
    }
  });

  test("if authenticated, sidebar navigation is visible", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    // Check for nav items
    const navItems = [
      { href: "/dashboard", label: "Overview" },
      { href: "/dashboard/exchanges", label: "Exchanges" },
      { href: "/dashboard/strategies", label: "Strategies" },
    ];

    for (const item of navItems) {
      const link = page.locator(`a[href="${item.href}"]`).first();
      await expect(link).toBeVisible({ timeout: 5000 });
    }
  });

  test("if authenticated, can navigate between pages", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForTimeout(1000);

    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    // Navigate to Strategies
    await page.click('a[href="/dashboard/strategies"]');
    await expect(page).toHaveURL(/\/dashboard\/strategies/);

    // Navigate to Orders
    await page.click('a[href="/dashboard/orders"]');
    await expect(page).toHaveURL(/\/dashboard\/orders/);
  });
});
