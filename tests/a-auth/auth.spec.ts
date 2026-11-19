import { test, expect, qaUser } from "../../fixtures/qa";

// Suite A · Autenticación y perfiles (contexto_qa.md, TC-A01..A03 + casos negativos).

test.describe("Suite A · Autenticación", () => {
  test("TC-SMOKE La app carga y muestra el login QA", async ({ app }, testInfo) => {
    testInfo.annotations.push({ type: "role", description: "Visitante" });
    await app.goto();
    await expect(app.page).toHaveTitle(/.+/);
    await expect(app.loginButton).toBeVisible();
  });

  test("TC-A01 Jugador con equipo entra y ve la navegación completa", async ({ app, loginAs }) => {
    const user = await loginAs("player_mad");
    await expect(app.profileButton).toContainText(user.nickname);
    for (const tab of ["Calendario", "Partidas", "Jugadores", "Normas"]) {
      await expect(app.navTab(tab)).toBeVisible();
    }
    await expect(app.newEventButton).toBeVisible();
  });

  test("TC-A01b Usuario sin equipo queda pendiente de asignación", async ({ app, loginAs }) => {
    await loginAs("sinequipo");
    await expect(app.page.getByRole("heading", { name: "Pendiente de asignación de equipo" })).toBeVisible();
    await expect(app.nav).toBeHidden();
    await expect(app.newEventButton).toBeHidden();
  });

  // BUG conocido (19-nov-2026): la política RLS "Lectura de perfiles por unidad" exige
  // NOT is_current_user_blocked() también para el propio perfil, así que un bloqueado no puede
  // leerse a sí mismo y la app le muestra "Pendiente de asignación" (sin nombre) en vez de
  // "Acceso denegado". Este test se deja en rojo a propósito hasta que se corrija.
  test("TC-A02 Usuario bloqueado ve acceso denegado", async ({ app, loginAs }) => {
    await loginAs("blocked");
    await expect(app.page.getByRole("heading", { name: "Acceso denegado" })).toBeVisible();
  });

  test("TC-A02b Usuario bloqueado no accede a ningún dato", async ({ app, loginAs }) => {
    await loginAs("blocked");
    await expect(app.page.getByText(/Pendiente de asignación|Acceso denegado/)).toBeVisible();
    await expect(app.nav).toBeHidden();
    await expect(app.newEventButton).toBeHidden();
    await expect(app.page.locator("article.event-card")).toHaveCount(0);
  });

  test("TC-A04 Contraseña incorrecta muestra error y no entra", async ({ app }, testInfo) => {
    testInfo.annotations.push({ type: "role", description: "Visitante" });
    await app.goto();
    await app.login(qaUser("player_mad").email, "contraseña-incorrecta");
    await app.expectToast(/Error al iniciar sesión/);
    await expect(app.loginButton).toBeVisible();
    await expect(app.nav).toBeHidden();
  });

  test("TC-A05 Cerrar sesión vuelve a la pantalla de login", async ({ app, loginAs }) => {
    await loginAs("player_mad");
    await app.logoutButton.click();
    await expect(app.loginButton).toBeVisible();
    await expect(app.nav).toBeHidden();
  });

  test("TC-A03 Editar la ficha de operador guarda equipaciones y roles", async ({ app, loginAs }) => {
    const user = await loginAs("player_foe");
    const ficha = app.modal.filter({ has: app.page.getByRole("heading", { name: "Tu ficha de operador" }) });

    await app.profileButton.click();
    await expect(ficha).toBeVisible();
    await ficha.getByRole("button", { name: /^MultiCam/ }).click();
    await ficha.getByRole("button", { name: /^Médico/ }).click();
    await ficha.getByRole("button", { name: "Guardar perfil" }).click();
    await app.expectToast(`Perfil actualizado: ${user.nickname}.`);
    await expect(ficha).toBeHidden();

    // Persistencia: tras recargar, la ficha conserva lo marcado.
    await app.page.reload();
    await app.profileButton.click();
    await expect(ficha.getByRole("button", { name: /^MultiCam ✓/ })).toBeVisible();
    await expect(ficha.getByRole("button", { name: /^Médico ✓/ })).toBeVisible();
  });
});
