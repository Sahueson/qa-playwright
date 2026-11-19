import { expect, type Locator, type Page } from "@playwright/test";

// Page object de Tactical Calendar. La app solo tiene data-testid en el login QA;
// el resto se localiza por rol y texto visibles, como lo haría un usuario.
export class AppPage {
  readonly nav: Locator;
  readonly newEventButton: Locator;
  readonly logoutButton: Locator;
  readonly profileButton: Locator;
  readonly toast: Locator;
  readonly modal: Locator;

  constructor(readonly page: Page) {
    this.nav = page.getByRole("navigation", { name: "Navegación principal" });
    this.newEventButton = page.getByRole("button", { name: "+ Nueva partida" });
    this.logoutButton = page.locator(".app-header").getByRole("button", { name: "Salir" });
    this.profileButton = page.getByTitle("Editar mi ficha de operador");
    this.toast = page.locator(".tactical-toast");
    this.modal = page.locator(".modal");
  }

  // ---------- Login QA ----------
  async goto() {
    await this.page.goto("/");
  }

  async login(email: string, password: string) {
    await this.page.getByTestId("qa-email-input").fill(email);
    await this.page.getByTestId("qa-password-input").fill(password);
    await this.page.getByTestId("qa-login-btn").click();
  }

  get loginButton() {
    return this.page.getByTestId("qa-login-btn");
  }

  // ---------- Navegación ----------
  navTab(label: string) {
    return this.nav.getByRole("button", { name: label, exact: true });
  }

  async openTab(label: string) {
    await this.navTab(label).click();
  }

  // ---------- Partidas ----------
  eventCard(title: string) {
    return this.page.locator("article.event-card").filter({ hasText: title });
  }

  // Títulos de las partidas que el usuario ve en la pestaña Partidas.
  async visibleEventTitles(): Promise<string[]> {
    await this.openTab("Partidas");
    await expect(this.page.locator("article.event-card").first()).toBeVisible();
    return this.page.locator("article.event-card .event-card__title").allInnerTexts();
  }

  async openEvent(title: string) {
    await this.openTab("Partidas");
    await this.eventCard(title).locator(".tactical-btn--blue").click();
    await expect(this.modal.getByRole("heading", { name: "Detalle de partida" })).toBeVisible();
  }

  // ---------- FOE · Votos y Faltas ----------
  async openFoeSection(label: "Votos · Junta Operativa" | "Votos · Junta Directiva" | "Faltas y Sanciones") {
    await this.openTab("FOE · Votos y Faltas");
    await this.page.getByRole("button", { name: label, exact: true }).click();
  }

  pollCard(title: string) {
    return this.page.locator(".tactical-card").filter({ has: this.page.getByRole("heading", { name: title }) });
  }

  // Formulario de inscripción del detalle de partida.
  get registrationGear() {
    return this.modal.locator(".inscribir-form select").nth(0);
  }
  get registrationRole() {
    return this.modal.locator(".inscribir-form select").nth(1);
  }

  async expectToast(text: string | RegExp) {
    await expect(this.toast.filter({ hasText: text })).toBeVisible();
  }
}
