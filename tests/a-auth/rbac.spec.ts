import { test, expect } from "../../fixtures/qa";

// Suite A · Visibilidad por rol (RBAC). Comprueba en la interfaz lo que impone el RLS del
// staging: cada equipo solo ve sus partidas y la Junta solo es visible para sus miembros.
// Datos: seed de reset-staging (partidas MAD y FOE + 1 votación de la Junta Directiva).

// Partidas del seed (reset-staging/reset.js). Se comprueba qué se ve y qué no, sin contar el
// total exacto, para que añadir partidas al seed no rompa estos tests.
const MAD = ["QA MAD · Partida próxima", "QA MAD · Partida en excedencia"];
const FOE = [
  "QA FOE · Partida próxima",
  "QA FOE · MilSim próxima",
  "QA FOE · Partida en menos de 48 h",
  "QA FOE · Partida finalizada",
  "QA FOE · Inscripción abierta",
];
const VOTACION_DIRECTIVA = "QA · Votación de la Junta Directiva";

test.describe("Suite A · Visibilidad por rol", () => {
  test("TC-A06 Jugador MAD solo ve partidas MAD y no tiene pestaña FOE", async ({ app, loginAs }) => {
    await loginAs("player_mad");
    const titles = await app.visibleEventTitles();
    for (const t of MAD) expect(titles.some((x) => x.includes(t))).toBe(true);
    expect(titles.every((x) => x.includes("QA MAD"))).toBe(true);
    await expect(app.navTab("FOE · Votos y Faltas")).toBeHidden();
  });

  test("TC-A07 Jugador FOE ve las partidas FOE y ninguna MAD", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    const titles = await app.visibleEventTitles();
    for (const t of FOE) expect(titles.some((x) => x.includes(t))).toBe(true);
    expect(titles.every((x) => x.includes("QA FOE"))).toBe(true);
    await expect(app.navTab("FOE · Votos y Faltas")).toBeVisible();
  });

  test("TC-A08 Super admin ve las partidas de ambos equipos", async ({ app, loginAs }) => {
    await loginAs("superadmin");
    const titles = await app.visibleEventTitles();
    for (const t of [...MAD, ...FOE]) expect(titles.some((x) => x.includes(t))).toBe(true);
  });

  test("TC-A09 Jugador FOE sin cargo no ve la Junta Directiva", async ({ app, loginAs }) => {
    await loginAs("player_foe");
    await app.openTab("FOE · Votos y Faltas");
    await expect(app.page.getByRole("button", { name: "Faltas y Sanciones" })).toBeVisible();
    await expect(app.page.getByRole("button", { name: "Votos · Junta Directiva" })).toBeHidden();
    await expect(app.page.getByText(VOTACION_DIRECTIVA)).toBeHidden();
  });

  test("TC-A10 Miembro de la Junta Directiva ve su votación", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openTab("FOE · Votos y Faltas");
    await app.page.getByRole("button", { name: "Votos · Junta Directiva" }).click();
    await expect(app.page.getByText(VOTACION_DIRECTIVA)).toBeVisible();
  });
});
