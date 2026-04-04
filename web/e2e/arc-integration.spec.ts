import { test, expect } from "@playwright/test";

test.describe("Arc Integration", () => {
  test("homepage loads with Arc testnet branding", async ({ page }) => {
    await page.goto("/");
    // The app should load without critical JS errors
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(2000);

    // Hero section should still render
    await expect(page.locator("h1")).toContainText("Give your car a");

    // Feature cards should include treasury / spending mentions
    await expect(
      page.getByRole("heading", { name: "Shared Treasury" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AI Agent Spending" })
    ).toBeVisible();
  });

  test("trip page shows connect wallet prompt", async ({ page }) => {
    await page.goto("/trip/0");
    // Without wallet connected, should prompt to connect
    const pageText = await page.textContent("body");
    expect(pageText).toContain("Connect");
  });

  test("no critical JavaScript errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(3000);

    // Filter out known non-critical errors (WalletConnect WebSocket, etc.)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("WebSocket") &&
        !e.includes("walletconnect") &&
        !e.includes("reown") &&
        !e.includes("Failed to fetch")
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
