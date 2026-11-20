import { test, expect, resetStaging } from "../../fixtures/qa";

// Suite D · Motor de asistencia (contexto_qa.md, TC-D01..D03, Art. 33 y 34 de los Estatutos).
// El % se calcula sobre las partidas computables FOE del año (seed: finalizada 1, pasada abierta
// 1 y MilSim pasada 1,5 = 3,5). Se resetea al empezar porque otras suites alteran ese total.

test.describe("Suite D · Asistencia", () => {
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-D01 El % anual se calcula sobre las partidas ya jugadas", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openTab("Jugadores");
    const att = app.attendanceOf("QA Jugador FOE"); // asistió a 1 de 3,5
    await expect(att).toContainText("29% (1/3,5)");
    await expect(att).toContainText("Por debajo del mínimo anual FOE (60% · Art. 33)");
  });

  test("TC-D02 Una MilSim pesa x1,5 en la asistencia", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openTab("Jugadores");
    // junta2 solo fue a la MilSim pasada: suma 1,5, no 1.
    await expect(app.attendanceOf("QA Junta 2")).toContainText("(1,5/");
  });

  test("TC-D03 Las partidas durante una excedencia aprobada no restan", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openTab("Jugadores");
    // Sin la excedencia serían 1,5/3,5 = 43 %; con ella la pasada abierta no computa.
    const att = app.attendanceOf("QA Junta 2");
    await expect(att).toContainText("60% (1,5/2,5)");
    await expect(att).toContainText("Cumple mínimo anual FOE (60%)");
  });

  test("TC-D04 Cerrar el acta con asistencia actualiza el % del jugador", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openEvent("QA FOE · Partida pasada abierta");
    const row = app.modal.locator(".event-detail__reg-row").filter({ hasText: "QA Jugador FOE" });
    await row.getByRole("checkbox").check();
    await expect(row.getByRole("checkbox")).toBeChecked(); // sigue marcada al guardar
    await app.modal.getByRole("button", { name: "Guardar asistencia y bloquear partida" }).click();
    await app.expectToast("Asistencia guardada y partida bloqueada.");
    await app.modal.getByRole("button", { name: "Cerrar", exact: true }).click();

    await app.openTab("Jugadores");
    await expect(app.attendanceOf("QA Jugador FOE")).toContainText("57% (2/3,5)");
  });

  // Regresión del bug (c), corregido en bfdc0e2: al abrir el detalle la app recarga los datos y
  // esa recarga reiniciaba el borrador de asistencia, borrando lo que el admin ya había marcado
  // (se guardaba mal y la partida quedaba bloqueada). Para que la recarga llegue SIEMPRE después
  // de la marca, se retrasa a propósito su respuesta 1,5 s.
  test("TC-D05 Una marca hecha nada más abrir la partida no se pierde con la recarga", async ({ app, loginAs }) => {
    await loginAs("junta2");
    await app.openTab("Partidas");
    let reloadDone = false;
    await app.page.route(/\/rest\/v1\/event_registrations/, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await new Promise((r) => setTimeout(r, 1_500));
      await route.continue();
      reloadDone = true;
    });

    await app.eventCard("QA FOE · Partida finalizada").locator(".tactical-btn--blue").click();
    const checkbox = app.modal.locator(".event-detail__reg-row").filter({ hasText: "QA Admin FOE" }).getByRole("checkbox");
    // El borrador se rellena justo después de pintar el modal (en el primer instante sale vacío).
    await expect(checkbox).toBeChecked();
    await checkbox.uncheck();
    expect(reloadDone).toBe(false); // la marca va antes de que llegue la recarga

    await expect.poll(() => reloadDone, { timeout: 15_000 }).toBe(true);
    await app.waitForQuietNetwork();
    await expect(checkbox).not.toBeChecked();
    await app.page.unroute(/\/rest\/v1\/event_registrations/);
    await app.modal.getByRole("button", { name: "Guardar asistencia y bloquear partida" }).click();
    await app.expectToast("Asistencia guardada y partida bloqueada.");

    // Lo guardado en la base de datos, no solo en pantalla.
    await app.page.reload();
    await app.waitForQuietNetwork();
    await app.openTab("Jugadores");
    await expect(app.attendanceOf("QA Admin FOE")).toContainText("0% (0/3,5)");
  });
});
