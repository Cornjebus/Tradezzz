import { test, expect } from "@playwright/test";

test.describe("AI Providers Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard/ai-providers");
    await page.waitForTimeout(1000);
  });

  test("page loads (authenticated or redirects)", async ({ page }) => {
    const url = page.url();
    expect(url.includes("/dashboard/ai-providers") || url.includes("/sign-in")).toBe(true);
  });

  test("if authenticated, displays AI provider heading", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    await expect(page.getByRole("heading", { name: /AI Provider/i }).first()).toBeVisible();
  });

  test("if authenticated, displays available AI providers", async ({ page }) => {
    const url = page.url();
    if (url.includes("/sign-in")) {
      test.skip();
      return;
    }

    const providerNames = ["OpenAI", "Anthropic", "Google", "DeepSeek", "Mistral", "Cohere"];
    let foundProviders = 0;

    for (const provider of providerNames) {
      const element = page.getByText(provider, { exact: false }).first();
      const isVisible = await element.isVisible().catch(() => false);
      if (isVisible) foundProviders++;
    }

    expect(foundProviders).toBeGreaterThan(0);
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
