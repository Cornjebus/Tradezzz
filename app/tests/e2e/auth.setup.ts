/**
 * Authentication setup for E2E tests
 *
 * For local development, tests will work with the sign-in page.
 * For CI, you would need to set up Clerk test credentials or mock auth.
 *
 * Options for E2E auth testing:
 * 1. Use Clerk's testing tokens (requires CLERK_SECRET_KEY in test env)
 * 2. Mock the auth at the API level
 * 3. Test the sign-in flow separately and authenticated pages with session
 */

import { test as base } from "@playwright/test";

// Extend test to handle auth state
export const test = base.extend({
  // Check if we're authenticated or need to skip auth-required tests
  page: async ({ page }, use) => {
    // You could add auth logic here if needed
    await use(page);
  },
});

export { expect } from "@playwright/test";

/**
 * Helper to check if user is on sign-in page
 */
export async function isOnSignInPage(page: import("@playwright/test").Page): Promise<boolean> {
  const url = page.url();
  return url.includes("/sign-in") || url.includes("/sign-up");
}

/**
 * Helper to skip test if not authenticated
 */
export async function skipIfNotAuthenticated(page: import("@playwright/test").Page): Promise<boolean> {
  const onSignIn = await isOnSignInPage(page);
  if (onSignIn) {
    console.log("Skipping test - user not authenticated");
    return true;
  }
  return false;
}
