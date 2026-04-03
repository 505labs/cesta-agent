import { test, expect } from "@playwright/test";

test.describe("Trip Page", () => {
  test("trip page requires wallet connection", async ({ page }) => {
    await page.goto("/trip/0");
    await expect(page.locator("text=Connect your wallet")).toBeVisible();
  });

  test("trip page shows connect prompt for unauthenticated users", async ({ page }) => {
    await page.goto("/trip/0");
    const connectPrompt = page.locator("text=Connect your wallet");
    await expect(connectPrompt).toBeVisible();
  });
});

test.describe("Homepage Dashboard", () => {
  test("homepage loads without critical errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors (WalletConnect/AppKit SDK init, SSR token errors)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("WalletConnect") &&
        !e.includes("projectId") &&
        !e.includes("appkit") &&
        !e.includes("Invalid or unexpected token")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
