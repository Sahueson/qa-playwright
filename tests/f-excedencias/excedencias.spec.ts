import { test, expect, resetStaging } from "../../fixtures/qa";

// Suite F · Excedencias FOE (Art. 18 y 19): las solicita el jugador, las concede la Junta
// Directiva y nadie se concede la suya. Duración entre 1 mes y 1 año.

const inDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("Suite F · Excedencias", () => {
  // Cada suite parte del seed: no depende del orden ni de lo que hayan tocado otras.
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-F01 Un jugador solicita una excedencia y queda pendiente de la Junta", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openLeavesPanel();
    const dates = app.page.locator('form input[type="date"]');
    await dates.nth(0).fill(inDays(40));
    await dates.nth(1).fill(inDays(80));
    await app.page.getByPlaceholder(/Motivos laborales \/ Lesión/).fill("Excedencia E2E · lesión");
    await app.page.getByRole("button", { name: "Solicitar excedencia a Junta Directiva" }).click();

    await app.expectToast("Solicitud de excedencia enviada.");
    const row = app.leaveRow("Excedencia E2E · lesión");
    await expect(row).toContainText("PENDIENTE DE JUNTA");
    await expect(row.getByRole("button", { name: "Conceder" })).toBeHidden();
  });

  test("TC-F02 Una excedencia de menos de 1 mes se rechaza", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openLeavesPanel();
    const dates = app.page.locator('form input[type="date"]');
    await dates.nth(0).fill(inDays(40));
    await dates.nth(1).fill(inDays(45));
    await app.page.getByPlaceholder(/Motivos laborales \/ Lesión/).fill("Excedencia E2E · corta");
    await app.page.getByRole("button", { name: "Solicitar excedencia a Junta Directiva" }).click();

    await app.expectToast(/La excedencia debe tener una duración mínima de 1 mes/);
    await expect(app.page.getByText("Excedencia E2E · corta")).toBeHidden();
  });

  test("TC-F03 La Junta Directiva concede una solicitud pendiente", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openLeavesPanel();
    const row = app.leaveRow("Solicitud QA pendiente"); // de QA Jugador FOE (seed)

    await expect(row).toContainText("PENDIENTE DE JUNTA");
    await row.getByRole("button", { name: "Conceder" }).click();
    await app.expectToast("Excedencia concedida.");
    await expect(row).toContainText("CONCEDIDA");
  });

  test("TC-F04 Nadie puede concederse su propia excedencia", async ({ app, loginAs }) => {
    await loginAs("admin_foe"); // es de la Junta Directiva, pero la solicitud es suya
    await app.openLeavesPanel();
    const row = app.leaveRow("Solicitud QA propia");

    await expect(row).toContainText("PENDIENTE DE JUNTA");
    await expect(row.getByRole("button", { name: "Conceder" })).toBeHidden();
  });

  test("TC-F05 Un jugador sin cargo no puede conceder excedencias", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openLeavesPanel();
    await expect(app.page.getByRole("button", { name: "Conceder" })).toHaveCount(0);
    await expect(app.page.getByRole("button", { name: "Conceder y aplicar excedencia" })).toHaveCount(0);
  });
});
