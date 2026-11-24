import { test, expect, resetStaging } from "../../fixtures/qa";

// Suite C · Inscripciones y reglas de negocio (contexto_qa.md, TC-C01..C03 + casos límite).
// Usa partidas propias del seed para no depender de lo que modifica la suite B.

test.describe("Suite C · Inscripciones", () => {
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-C01 Inscribirse preselecciona la equipación de la partida y avisa si no la tienes", async ({ app, loginAs }) => {
    // junta2 tiene Árido en su ficha; la partida recomienda Tiger Stripe. (Con la ficha vacía la
    // app no avisa: el aviso solo sale si tienes equipaciones marcadas y no es ninguna de ellas.)
    await loginAs("junta2");
    await app.openEvent("QA FOE · Inscripción abierta");

    await expect(app.registrationGear).toHaveText("Tiger Stripe");
    await expect(app.modal.getByText("No tienes «Tiger Stripe» marcada en tu ficha")).toBeVisible();

    await app.modal.getByRole("button", { name: "Apuntarse" }).click();
    await app.expectToast("Inscripción guardada en la nube.");
    await expect(app.modal.getByText("Inscritos (1)")).toBeVisible();
    await expect(app.modal.getByText("QA Junta 2 (Tú)")).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Actualizar inscripción" })).toBeVisible();
  });

  test("TC-C07 Sin equipación en la partida se preselecciona la de la ficha del jugador", async ({ app, loginAs }) => {
    await loginAs("junta2"); // ficha: Árido + Médico
    await app.openEvent("QA FOE · MilSim próxima"); // sin equipación recomendada

    await expect(app.registrationGear).toContainText("Árido");
    await expect(app.registrationRole).toContainText("Médico");
    await expect(app.modal.getByText(/No tienes «.*» marcada/)).toBeHidden();
  });

  test("TC-C04 Darse de baja a más de 48 h libera la plaza", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openEvent("QA FOE · Inscripción abierta");
    await app.modal.getByRole("button", { name: "Apuntarse" }).click();
    await app.expectToast("Inscripción guardada en la nube.");

    await app.modal.getByRole("button", { name: "Darse de baja" }).click();
    await app.expectToast("Has cancelado tu inscripción.");
    await expect(app.modal.getByText("QA Jugador FOE (Tú)")).toBeHidden();
    await expect(app.modal.getByRole("button", { name: "Apuntarse" })).toBeVisible();
  });

  test("TC-C02 A menos de 48 h no se permite darse de baja", async ({ app, loginAs }) => {
    await loginAs("player_foe"); // inscrito por el seed
    await app.openEvent("QA FOE · Partida en menos de 48 h");

    await expect(app.modal.getByText(/Faltan menos de 48 horas para la partida/)).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Darse de baja" })).toBeHidden();
    // Sí puede actualizar equipación o rol.
    await expect(app.modal.getByRole("button", { name: "Actualizar inscripción" })).toBeVisible();
  });

  test("TC-C03 Con una excedencia aprobada no se puede inscribir en esas fechas", async ({ app, loginAs }) => {
    await loginAs("player_mad"); // excedencia aprobada que cubre la partida
    await app.openTab("Partidas");
    await expect(app.eventCard("QA MAD · Partida en excedencia").getByRole("button", { name: "En excedencia" })).toBeVisible();

    await app.openEvent("QA MAD · Partida en excedencia");
    await expect(app.modal.getByText(/Tienes una excedencia concedida/)).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Apuntarse" })).toBeHidden();
  });

  test("TC-C05 Una partida ya finalizada no admite inscripciones", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openEvent("QA FOE · Partida pasada abierta");

    await expect(app.modal.getByText(/ya ha finalizado; las inscripciones y bajas están cerradas/)).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Apuntarse" })).toBeHidden();
  });

  test("TC-C06 Una partida cancelada no admite inscripciones", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openEvent("QA FOE · Partida cancelada");

    await expect(app.modal.getByText("CANCELADA · NO CUENTA")).toBeVisible();
    await expect(app.modal.getByText(/está cancelada; no se permiten inscripciones/)).toBeVisible();
    await expect(app.modal.getByRole("button", { name: "Apuntarse" })).toBeHidden();
  });
});
