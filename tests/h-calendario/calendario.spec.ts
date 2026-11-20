import { test, expect, resetStaging } from "../../fixtures/qa";
import type { AppPage } from "../../pages/app-page";

// Suite H · Calendario: fechas de vacaciones / "No se juega" (team_blackouts). Las marca un
// admin para su equipo (el super admin también para ambos) y solo las ve cada equipo (RLS).
// Seed: "QA · Sin partida FOE" (días +25 a +26) y "QA · Sin partida MAD" (día +27).

const ymd = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Fila del listado "Vacaciones / Sin partida": <fila><botón con fechas · motivo/><Quitar/></fila>.
const blackoutRow = (app: AppPage, reason: string) =>
  app.page.getByRole("button", { name: new RegExp(`· ${reason}$`) }).locator("xpath=..");

async function openBlackoutForm(app: AppPage) {
  await app.openTab("Calendario");
  await app.page.getByRole("button", { name: 'Marcar vacaciones / "No se juega"' }).click();
  return app.page.locator("form").filter({ has: app.page.getByRole("button", { name: "Guardar fechas sin partida" }) });
}

test.describe("Suite H · Calendario y fechas sin partida", () => {
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-H01 Un admin marca fechas sin partida para su equipo", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    const form = await openBlackoutForm(app);
    const reason = `QA E2E · Puente ${Date.now()}`;
    const dates = form.locator('input[type="date"]');
    await dates.nth(0).fill(ymd(40));
    await dates.nth(1).fill(ymd(42));
    await form.getByPlaceholder("Ej. Vacaciones de verano / Puente").fill(reason);
    await form.getByRole("button", { name: "Guardar fechas sin partida" }).click();

    await app.expectToast('Fechas de vacaciones / "No se juega" guardadas.');
    await expect(form).toBeHidden();
    await expect(blackoutRow(app, reason)).toContainText(`[MAD Irregulars] ${ymd(40)} → ${ymd(42)}`);
  });

  test("TC-H02 La fecha de fin no puede ser anterior a la de inicio", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    const form = await openBlackoutForm(app);
    const dates = form.locator('input[type="date"]');
    const reason = `QA E2E · Fechas al revés ${Date.now()}`;
    await dates.nth(0).fill(ymd(50));
    await dates.nth(1).fill(ymd(45));
    await form.getByPlaceholder("Ej. Vacaciones de verano / Puente").fill(reason);
    await form.getByRole("button", { name: "Guardar fechas sin partida" }).click();

    // "Hasta" lleva min = "Desde": la validación del propio navegador impide enviar el
    // formulario (el mensaje de la app no llega a salir). No se guarda nada.
    expect(await dates.nth(1).evaluate((el: HTMLInputElement) => el.validity.rangeUnderflow)).toBe(true);
    await expect(form).toBeVisible();
    await expect(blackoutRow(app, reason)).toHaveCount(0);
  });

  test("TC-H03 Un admin de un solo equipo no puede marcar fechas para ambos", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    const form = await openBlackoutForm(app);
    const options = await form.locator("select option").allInnerTexts();
    expect(options).toEqual(["MAD Irregulars"]);
  });

  test("TC-H04 El super admin puede marcar fechas para ambos equipos", async ({ app, loginAs }) => {
    await loginAs("superadmin");
    const form = await openBlackoutForm(app);
    await expect(form.locator("select option")).toHaveText([
      "MAD Irregulars", "FOE", "Ambos equipos (MAD Irregulars y FOE)",
    ]);
    // Y ve las fechas de los dos equipos.
    await expect(blackoutRow(app, "QA · Sin partida FOE")).toBeVisible();
    await expect(blackoutRow(app, "QA · Sin partida MAD")).toBeVisible();
  });

  test("TC-H05 Cada equipo solo ve sus fechas y un jugador no puede quitarlas", async ({ app, loginAs }) => {
    await loginAs("player_mad");
    await app.openTab("Calendario");
    const mad = blackoutRow(app, "QA · Sin partida MAD");
    await expect(mad).toBeVisible();
    await expect(mad.getByRole("button", { name: "Quitar" })).toHaveCount(0);
    await expect(blackoutRow(app, "QA · Sin partida FOE")).toHaveCount(0);
    await expect(app.page.getByRole("button", { name: 'Marcar vacaciones / "No se juega"' })).toBeHidden();
  });

  test("TC-H06 Un admin quita las fechas de su equipo y no persisten al recargar", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    await app.openTab("Calendario");
    await blackoutRow(app, "QA · Sin partida MAD").getByRole("button", { name: "Quitar" }).click();

    await app.expectToast("Fechas eliminadas del calendario.");
    await expect(blackoutRow(app, "QA · Sin partida MAD")).toHaveCount(0);
    await app.page.reload();
    await app.waitForQuietNetwork();
    await app.openTab("Calendario");
    await expect(app.page.getByRole("button", { name: 'Marcar vacaciones / "No se juega"' })).toBeVisible();
    await expect(blackoutRow(app, "QA · Sin partida MAD")).toHaveCount(0);
  });

  test("TC-H07 Un día sin partida se avisa al seleccionarlo en el calendario", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openTab("Calendario");
    // Pulsar la fila lleva el calendario a ese mes y selecciona el primer día.
    await app.page.getByRole("button", { name: /· QA · Sin partida FOE$/ }).click();
    await expect(app.page.getByText(/No se juega \(FOE\):/)).toBeVisible();
    await expect(app.page.getByText(/No se juega \(FOE\):/).locator("xpath=..")).toContainText("QA · Sin partida FOE");
  });
});
