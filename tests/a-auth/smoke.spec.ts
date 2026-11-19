import { test, expect } from "@playwright/test";

test("TC-SMOKE La app carga", async ({ page }) => {
  test.info().annotations.push({ type: "role", description: "Visitante" });
  await page.goto("/");
  await expect(page).toHaveTitle(/.+/);
});