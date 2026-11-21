import { test, expect, resetStaging } from "../../fixtures/qa";

// Suite J · Demo de fallos. Escenarios que FALLAN A PROPÓSITO (requisitos que la app no cumple) para enseñar cómo
// sale un fallo y su reporte de bug. No modifican nada: solo inician sesión y buscan algo que no existe.
// No forman parte de las suites A-I ni del mapa de resultados "reales".
const VISIBLE = { timeout: 3000 };

test.describe("Suite J · Demo de fallos (fallan a propósito)", () => {
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-J01 El jugador MAD ve las partidas del equipo FOE (requisito inexistente)", async ({ app, loginAs }) => {
    await loginAs("player_mad");
    await expect(app.page.getByText("QA FOE · Partida próxima").first()).toBeVisible(VISIBLE);
  });

  test("TC-J02 El jugador FOE ve las partidas del equipo MAD (requisito inexistente)", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await expect(app.page.getByText("QA MAD · Partida próxima").first()).toBeVisible(VISIBLE);
  });

  test("TC-J03 El super admin dispone de un panel de métricas", async ({ app, loginAs }) => {
    await loginAs("superadmin");
    await expect(app.page.getByRole("heading", { name: "Panel de métricas" })).toBeVisible(VISIBLE);
  });

  test("TC-J04 El jugador sin equipo puede crear partidas", async ({ app, loginAs }) => {
    await loginAs("sinequipo");
    await expect(app.page.getByRole("button", { name: "Crear partida" })).toBeVisible(VISIBLE);
  });

  test("TC-J05 El jugador bloqueado sigue viendo el calendario de su equipo", async ({ app, loginAs }) => {
    await loginAs("blocked");
    await expect(app.page.getByText("QA MAD · Partida próxima").first()).toBeVisible(VISIBLE);
  });

  test("TC-J06 El admin MAD tiene una pestaña de Facturación", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    await expect(app.page.getByRole("button", { name: "Facturación" })).toBeVisible(VISIBLE);
  });

  test("TC-J07 El jugador MAD puede exportar el calendario a PDF", async ({ app, loginAs }) => {
    await loginAs("player_mad");
    await expect(app.page.getByRole("button", { name: "Exportar calendario (PDF)" })).toBeVisible(VISIBLE);
  });
});
