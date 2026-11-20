import { test, expect, resetStaging } from "../../fixtures/qa";

// Suite B · Ciclo de vida de partidas: crear, cancelar, reactivar, editar, eliminar, cerrar el
// acta y desbloquearla (aprobación de los demás responsables, RPC del servidor).
// Cada test actúa sobre una partida distinta del seed, así no dependen del orden.

const futureDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

test.describe("Suite B · Ciclo de vida de partidas", () => {
  // Cada suite parte del seed: no depende del orden ni de lo que hayan tocado otras.
  test.beforeAll(async () => {
    await resetStaging();
  });

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

  test("TC-B05 Un admin edita una partida de su equipo", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    const title = `QA MAD · Partida editada ${Date.now()}`;
    await app.openTab("Partidas");
    await app.eventCard("QA MAD · Partida a editar").getByRole("button", { name: "Editar", exact: true }).click();

    const form = app.modal.filter({ has: app.page.getByRole("heading", { name: "Editar partida" }) });
    await form.getByPlaceholder("Ej. Dominical CQB / Operación Tormenta").fill(title);
    await form.getByRole("button", { name: "Guardar cambios" }).click();

    await app.expectToast("Partida actualizada.");
    await expect(form).toBeHidden();
    await expect(app.eventCard(title)).toBeVisible();
    await expect(app.eventCard("QA MAD · Partida a editar")).toHaveCount(0);
  });

  test("TC-B06 Reactivar una partida cancelada", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openEvent("QA FOE · Partida cancelada");

    await app.modal.getByRole("button", { name: "Reactivar partida" }).click();

    await app.expectToast("Partida reactivada.");
    await expect(app.modal.getByText(/^CANCELADA/)).toBeHidden();
    await expect(app.modal.getByRole("button", { name: "Cancelar partida" })).toBeVisible();
  });

  test("TC-B07 Eliminar una partida pide confirmación y la borra del servidor", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    await app.openTab("Partidas");
    const card = app.eventCard("QA MAD · Partida a eliminar");

    await card.getByRole("button", { name: "Eliminar", exact: true }).click();
    // Primer clic solo muestra la confirmación; el botón pasa a "Cancelar".
    await expect(card.getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();
    await card.getByRole("button", { name: "Confirmar eliminar partida" }).click();

    await app.expectToast("Partida eliminada.");
    await expect(card).toHaveCount(0);
    // Tras recargar sigue sin estar: se borró en la base de datos, no solo en pantalla.
    await app.page.reload();
    await app.waitForQuietNetwork();
    await app.openTab("Partidas");
    await expect(app.eventCard("QA MAD · Partida próxima")).toBeVisible();
    await expect(app.eventCard("QA MAD · Partida a eliminar")).toHaveCount(0);
  });

  test("TC-B08 Una partida cerrada no se puede editar ni eliminar desde la lista", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    await app.openTab("Partidas");
    const card = app.eventCard("QA MAD · Partida cerrada");

    await expect(card.getByRole("button", { name: "Ver acta / Desbloquear" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Editar", exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Eliminar", exact: true })).toHaveCount(0);
  });

  test("TC-B09 Un jugador no puede pedir el desbloqueo de un acta", async ({ app, loginAs }) => {
    await loginAs("player_mad");
    await app.openEvent("QA MAD · Partida cerrada");

    await expect(app.modal.getByText(/Partida cerrada y bloqueada/)).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Solicitar desbloqueo para editar" })).toBeHidden();
  });

  test("TC-B10 Desbloquear un acta MAD: la pide su admin y la aprueba el super admin", async ({ app, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs("admin_mad");
    await app.openEvent("QA MAD · Partida cerrada");
    await app.modal.getByRole("button", { name: "Solicitar desbloqueo para editar" }).click();

    // Responsables MAD aparte de quien lo pide: solo el super admin.
    await app.expectToast("Solicitud enviada. Pendiente de aprobación por 1 responsable.");
    await expect(app.modal.getByText("Solicitud de desbloqueo activa (iniciada por QA Admin MAD)")).toBeVisible();
    await expect(app.modal.getByText("Aprobaciones necesarias (0/1):")).toBeVisible();

    await loginAs("superadmin");
    await app.openEvent("QA MAD · Partida cerrada");
    await app.modal.getByRole("button", { name: "Aceptar desbloqueo" }).click();

    await app.expectToast("Todos han aprobado. Partida desbloqueada.");
    await expect(app.modal.getByText(/Partida cerrada y bloqueada/)).toBeHidden();
    await expect(app.modal.getByRole("button", { name: "Editar partida" })).toBeVisible();
  });

  test("TC-B11 Desbloquear un acta FOE necesita a los otros dos responsables y se puede cancelar", async ({ app, loginAs }) => {
    test.setTimeout(120_000);
    const title = "QA FOE · Partida pasada abierta";
    await loginAs("admin_foe");
    await app.openEvent(title);
    await app.modal.getByRole("button", { name: "Guardar asistencia y bloquear partida" }).click();
    await app.expectToast("Asistencia guardada y partida bloqueada.");

    await app.modal.getByRole("button", { name: "Solicitar desbloqueo para editar" }).click();
    // Responsables FOE aparte de admin_foe: super admin y QA Junta 2 (Junta Operativa).
    await app.expectToast("Solicitud enviada. Pendiente de aprobación por 2 responsables.");

    await loginAs("junta2");
    await app.openEvent(title);
    // Solo quien lo pidió (o el super admin) puede cancelar la solicitud.
    await expect(app.modal.getByRole("button", { name: "Cancelar solicitud" })).toBeHidden();
    await app.modal.getByRole("button", { name: "Aceptar desbloqueo" }).click();
    await app.expectToast("Tu aprobación ha quedado registrada.");
    await expect(app.modal.getByText("Aprobaciones necesarias (1/2):")).toBeVisible();
    await expect(app.modal.getByText(/Partida cerrada y bloqueada/)).toBeVisible();

    await loginAs("admin_foe");
    await app.openEvent(title);
    await app.modal.getByRole("button", { name: "Cancelar solicitud" }).click();
    await app.expectToast("Solicitud de desbloqueo cancelada.");
    await expect(app.modal.getByRole("button", { name: "Solicitar desbloqueo para editar" })).toBeVisible();
    await expect(app.modal.getByText(/Partida cerrada y bloqueada/)).toBeVisible();
  });
});
