import { test, expect, resetStaging } from "../../fixtures/qa";
import type { AppPage } from "../../pages/app-page";

// Suite G · Gestión de jugadores (pestaña Jugadores). Solo el super admin cambia rol, bloqueo,
// equipos y órganos FOE (updateMemberPermissions); el efecto se comprueba entrando con el
// jugador afectado. Cada test toca a un jugador distinto, así no dependen del orden. El reset
// vuelve a dejar los perfiles como en users.json.

// Desplegables de la ficha: el aria-label lleva el nombre del jugador, así que se localizan por data-testid.
const roleSelect = (app: AppPage, nickname: string) =>
  app.playerCard(nickname).locator('[data-testid^="roster-app-role-select-"]');
const addSquadSelect = (app: AppPage, nickname: string) =>
  app.playerCard(nickname).locator('[data-testid^="roster-add-squad-select-"]');
const blockButton = (app: AppPage, nickname: string) =>
  app.playerCard(nickname).locator('[data-testid^="roster-block-btn-"]');

test.describe("Suite G · Gestión de jugadores", () => {
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-G01 El super admin asciende a un jugador a admin y este gestiona partidas", async ({ app, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs("superadmin");
    await app.openTab("Jugadores");
    await app.chooseOption(roleSelect(app, "QA Jugador MAD"), "Admin (Partidas)");
    await app.expectToast("Ficha actualizada para QA Jugador MAD.");

    await loginAs("player_mad");
    await app.openTab("Partidas");
    const card = app.eventCard("QA MAD · Partida próxima");
    await expect(app.eventEditButton(card)).toBeVisible();
    await expect(app.eventDeleteButton(card)).toBeVisible();
  });

  test("TC-G02 El super admin bloquea a un jugador y este pierde el acceso", async ({ app, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs("superadmin");
    await app.openTab("Jugadores");
    const card = app.playerCard("QA Jugador FOE");
    await blockButton(app, "QA Jugador FOE").click();
    await app.expectToast("Ficha actualizada para QA Jugador FOE.");
    await expect(blockButton(app, "QA Jugador FOE")).toHaveText("Desbloquear");
    await expect(card.getByRole("heading", { name: "QA Jugador FOE [BLOQUEADO]" })).toBeVisible();

    await loginAs("player_foe");
    await expect(app.page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();
    await expect(app.nav).toBeHidden();
  });

  test("TC-G03 Asignar equipo a un jugador sin equipo le da acceso a ese equipo", async ({ app, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs("superadmin");
    await app.openTab("Jugadores");
    const card = app.playerCard("QA Sin Equipo");
    await expect(card.getByText("Sin equipo asignado")).toBeVisible();
    await app.chooseOption(addSquadSelect(app, "QA Sin Equipo"), "FOE");
    await app.expectToast("Ficha actualizada para QA Sin Equipo.");
    await expect(card.getByTitle("Quitar de FOE")).toBeVisible();

    await loginAs("sinequipo");
    await expect(app.nav).toBeVisible();
    await expect(app.navTab("FOE · Votos y Faltas")).toBeVisible();
    const titles = await app.visibleEventTitles();
    expect(titles.some((t) => t.includes("QA FOE · Partida próxima"))).toBe(true);
    expect(titles.every((t) => !t.includes("QA MAD"))).toBe(true);
  });

  test("TC-G04 Quitar la Junta Directiva a un miembro le oculta sus votaciones", async ({ app, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs("superadmin");
    await app.openTab("Jugadores");
    const card = app.playerCard("QA Junta 2");
    await card.getByRole("button", { name: "✓ Junta Directiva" }).click();
    await app.expectToast("Ficha actualizada para QA Junta 2.");
    await expect(card.getByRole("button", { name: "+ Junta Directiva" })).toBeVisible();

    await loginAs("junta2");
    await app.openTab("FOE · Votos y Faltas");
    await expect(app.page.getByRole("button", { name: "Votos · Junta Operativa" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Votos · Junta Directiva" })).toBeHidden();
  });

  test("TC-G05 Un admin que no es super admin no puede cambiar permisos", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openTab("Jugadores");
    const card = app.playerCard("QA Junta 2");
    await expect(card).toBeVisible();
    await expect(roleSelect(app, "QA Junta 2")).toHaveCount(0);
    await expect(blockButton(app, "QA Junta 2")).toHaveCount(0);
    await expect(card.getByTitle("Quitar de FOE")).toHaveCount(0);
    await expect(card.getByRole("button", { name: /Junta Operativa/ })).toBeDisabled();
  });

  test("TC-G06 El super admin no puede cambiarse el rol ni bloquearse a sí mismo", async ({ app, loginAs }) => {
    await loginAs("superadmin");
    await app.openTab("Jugadores");
    const card = app.playerCard("QA Super Admin");
    await expect(card).toBeVisible();
    await expect(roleSelect(app, "QA Super Admin")).toHaveCount(0);
    await expect(blockButton(app, "QA Super Admin")).toHaveCount(0);
  });

  test("TC-G07 Un admin de equipo solo ve a los jugadores de su equipo", async ({ app, loginAs }) => {
    await loginAs("admin_mad");
    await app.openTab("Jugadores");
    await expect(app.playerCard("QA Jugador MAD")).toBeVisible();
    await expect(app.playerCard("QA Jugador FOE")).toHaveCount(0);
    await expect(app.playerCard("QA Admin FOE")).toHaveCount(0);
    await expect(app.playerCard("QA Sin Equipo")).toHaveCount(0);
  });
});
