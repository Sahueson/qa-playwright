import { test, expect } from "../../fixtures/qa";

// Suite B · Ciclo de vida de partidas (contexto_qa.md, TC-B01..B03).
// Cada test actúa sobre una partida distinta del seed, así no dependen del orden.

const futureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("Suite B · Ciclo de vida de partidas", () => {
  test("TC-B01 Crear partida valida los campos obligatorios", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    await app.newEventButton.click();
    const form = app.modal.filter({ has: app.page.getByRole("heading", { name: "Nueva partida" }) });
    const submit = form.getByRole("button", { name: "Crear partida" });
    const error = form.locator(".modal__error");
    const date = form.locator('input[type="date"]');

    // El formulario propone una fecha por defecto: se vacía para probar su validación.
    await date.fill("");
    await submit.click();
    await expect(error).toHaveText("El título de la partida es obligatorio.");

    await form.getByPlaceholder("Ej. Dominical CQB / Operación Tormenta").fill("QA E2E · Validación");
    await submit.click();
    await expect(error).toHaveText("Selecciona la fecha de la partida.");

    await date.fill(futureDate(15));
    await submit.click();
    await expect(error).toHaveText("Indica el campo de juego.");
  });

  test("TC-B01b Un admin crea una partida y aparece en la lista", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    const title = `QA E2E · Partida creada ${Date.now()}`;

    await app.newEventButton.click();
    const form = app.modal.filter({ has: app.page.getByRole("heading", { name: "Nueva partida" }) });
    await form.getByPlaceholder("Ej. Dominical CQB / Operación Tormenta").fill(title);
    await form.locator('input[type="date"]').fill(futureDate(15));
    await form.locator('input[type="time"]').fill("10:00");
    await form.getByPlaceholder("Ej. El Cortijo / Bunker / Campo Norte").fill("Campo QA E2E");
    await form.getByRole("button", { name: "Crear partida" }).click();

    await app.expectToast("Partida creada para MAD Irregulars.");
    await expect(form).toBeHidden();
    await app.openTab("Partidas");
    await expect(app.eventCard(title)).toBeVisible();
  });

  test("TC-B02 Cancelar una partida sin contar asistencia", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    await app.openEvent("QA MAD · Partida próxima");

    await app.modal.getByRole("button", { name: "Cancelar partida" }).click();
    await app.modal.getByLabel(/No contar asistencia/).check();
    await app.modal.getByPlaceholder("Ej. Lluvia / Campo cerrado / Falta de jugadores").fill("Lluvia (QA)");
    await app.modal.getByRole("button", { name: "Confirmar cancelación" }).click();

    await app.expectToast("Partida cancelada y descontada del total de partidas.");
    await expect(app.modal.getByText("CANCELADA · NO CUENTA")).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Reactivar partida" })).toBeVisible();
  });

  test("TC-B02b Cancelar una partida contando asistencia permite pasar lista", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openEvent("QA FOE · Partida próxima");

    await app.modal.getByRole("button", { name: "Cancelar partida" }).click();
    await app.modal.getByLabel(/Sí, contar asistencia/).check();
    await app.modal.getByRole("button", { name: "Confirmar cancelación" }).click();

    await app.expectToast(/Partida cancelada \(cuenta asistencia/);
    await expect(app.modal.getByText("CANCELADA · CUENTA ASISTENCIA")).toBeVisible();
  });

  test("TC-B03 Cerrar el acta bloquea la partida en solo lectura", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openEvent("QA FOE · Partida finalizada");

    await app.modal.getByRole("button", { name: "Guardar asistencia y bloquear partida" }).click();

    await app.expectToast("Asistencia guardada y partida bloqueada.");
    await expect(app.modal.getByText("BLOQUEADA", { exact: true })).toBeVisible();
    await expect(app.modal.getByText(/Partida cerrada y bloqueada/)).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Editar partida" })).toBeHidden();
    await expect(app.modal.getByRole("button", { name: "Cancelar partida" })).toBeHidden();
  });

  test("TC-B04 Un jugador no puede editar ni cancelar partidas ajenas", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openEvent("QA FOE · MilSim próxima");

    await expect(app.modal.getByRole("button", { name: "Editar partida" })).toBeHidden();
    await expect(app.modal.getByRole("button", { name: "Cancelar partida" })).toBeHidden();
  });
});
