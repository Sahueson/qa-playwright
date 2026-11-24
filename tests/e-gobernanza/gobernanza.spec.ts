import { test, expect, resetStaging } from "../../fixtures/qa";

// Suite E · Gobernanza y régimen disciplinario FOE (contexto_qa.md, TC-E01..E05).
// El recuento, el cierre y el escalado los decide el servidor (close_foe_poll), así que estos
// tests comprueban las reglas de los Estatutos de punta a punta.
// Junta Directiva = QA Super Admin, QA Admin FOE y QA Junta 2. El seed deja cada expediente a
// falta de un voto (el de junta2), salvo el de recusación.

test.describe("Suite E · Gobernanza FOE", () => {
  // Cada suite parte del seed: no depende del orden ni de lo que hayan tocado otras.
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-E01 La Junta Directiva abre un expediente sancionador", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openFoeSection("Votos · Junta Directiva");
    await app.page.getByRole("button", { name: "+ Nueva votación" }).click();

    const form = app.page.locator("form").filter({ hasText: "Convocar votación en Junta Directiva" });
    await app.chooseOption(form.getByTestId("foe-poll-topic-select"), "Votación de sanción a operador");
    await app.chooseOption(form.getByTestId("foe-sanction-target-select"), "QA Jugador FOE");
    await app.chooseOption(form.getByTestId("foe-sanction-severity-select"), "Falta Grave");
    await form.getByPlaceholder(/Art\. 51\.i/).fill("Art. 36.2 — Baja < 48h");
    await form.getByPlaceholder(/Explica los hechos/).fill("Baja sin aviso en la partida del domingo (E2E).");
    await form.getByRole("button", { name: "Publicar votación" }).click();

    const card = app.pollCard("Propuesta de Falta Grave a QA Jugador FOE");
    await expect(card).toBeVisible();
    await expect(card.getByText("Art. 36.2 — Baja < 48h")).toBeVisible();
    await expect(card.getByRole("button", { name: /A favor de sancionar/ })).toBeEnabled();
  });

  test("TC-E02 El propuesto para sanción queda recusado y no puede votar", async ({ app, loginAs }) => {
    await loginAs("junta2");
    await app.openFoeSection("Votos · Junta Directiva");
    const card = app.pollCard("QA · Sanción a QA Junta 2 (recusación)");

    await expect(card.getByText(/Recusación \(Art\. 53\.4\)/)).toBeVisible();
    await expect(card.getByRole("button", { name: /A favor de sancionar/ })).toBeDisabled();
    await expect(card.getByRole("button", { name: /En contra de sancionar/ })).toBeDisabled();
  });

  test("TC-E03 El expediente se cierra solo al votar el último miembro habilitado", async ({ app, loginAs }) => {
    await loginAs("junta2");
    await app.openFoeSection("Votos · Junta Directiva");
    const card = app.pollCard("QA · Sanción con cuórum pendiente");

    await card.getByRole("button", { name: /A favor de sancionar/ }).click();
    await app.expectToast(/Sanción aprobada \(2 a favor vs 0 en contra\) y registrada/);
    await expect(card.getByText("SANCIÓN APROBADA Y REGISTRADA")).toBeVisible();
  });

  test("TC-E04 La 3ª falta leve en un año se escala a Grave", async ({ app, loginAs }) => {
    await loginAs("junta2");
    await app.openFoeSection("Votos · Junta Directiva");
    await app.pollCard("QA · Tercera falta leve").getByRole("button", { name: /A favor de sancionar/ }).click();

    await app.expectToast(/Escalada a Grave por 3ª falta leve en 1 año · Art\. 51\.k/);
  });

  test("TC-E05 La 3ª falta grave en un año se escala a Muy Grave", async ({ app, loginAs }) => {
    await loginAs("junta2");
    await app.openFoeSection("Votos · Junta Directiva");
    await app.pollCard("QA · Tercera falta grave").getByRole("button", { name: /A favor de sancionar/ }).click();

    await app.expectToast(/Escalada a Muy Grave por 3ª falta grave en 1 año · Art\. 50\.m/);
  });

  test("TC-E06 Con mayoría en contra el expediente se cierra sin sanción", async ({ app, loginAs }) => {
    await loginAs("junta2");
    await app.openFoeSection("Votos · Junta Directiva");
    const card = app.pollCard("QA · Sanción a desestimar");

    await card.getByRole("button", { name: /En contra de sancionar/ }).click();
    await app.expectToast(/Votación cerrada \(0 a favor vs 3 en contra\)\. No se aplica sanción/);
    await expect(card.getByText("SANCIÓN DESESTIMADA")).toBeVisible();
  });

  test("TC-E07 Solo quien convoca (o el super admin) puede cerrar una votación a mano", async ({ app, loginAs }) => {
    await loginAs("junta2"); // no convocó la votación del seed
    await app.openFoeSection("Votos · Junta Directiva");
    await expect(app.pollCard("QA · Votación de la Junta Directiva").getByRole("button", { name: "Cerrar y resolver" })).toBeHidden();
  });

  test("TC-E08 Quien convocó la votación puede cerrarla a mano", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openFoeSection("Votos · Junta Directiva");
    const card = app.pollCard("QA · Votación de la Junta Directiva");

    await card.getByRole("button", { name: "Cerrar y resolver" }).click();
    await app.expectToast("Votación cerrada y resultado fijado.");
    await expect(card.getByRole("button", { name: "Cerrar y resolver" })).toBeHidden();
  });
});
