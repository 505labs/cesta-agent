import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("homepage loads with connect button", async ({ page }) => {
    await page.goto("/");
    // appkit-button is a web component (custom element) rendered in both nav and hero.
    // Target the one inside the nav bar.
    const connectButton = page.locator("nav appkit-button");
    await expect(connectButton).toBeAttached();
  });

  test("hero section shows when not connected", async ({ page }) => {
    await page.goto("/");
    // The h1 contains "Give your car a" and a child <span> with "wallet"
    await expect(page.locator("h1")).toContainText("Give your car a");
    await expect(page.locator("h1")).toContainText("wallet");
  });

  test("navigation bar renders correctly", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=RoadTrip Co-Pilot")).toBeVisible();
  });

  test("feature cards are displayed", async ({ page }) => {
    await page.goto("/");
    // Use heading role to target the h3 specifically, avoiding matching the paragraph text
    await expect(
      page.getByRole("heading", { name: "Voice-First" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Shared Treasury" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "AI Agent Spending" })
    ).toBeVisible();
  });
});
