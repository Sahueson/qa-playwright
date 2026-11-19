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

  // Espera a que la app lleve `quietMs` sin peticiones a Supabase (cargas en segundo plano).
  async waitForQuietNetwork(quietMs = 1500, timeoutMs = 15_000) {
    let last = Date.now();
    let inFlight = 0;
    const isApi = (url: string) => /\/(rest|auth)\/v1\//.test(url);
    const onRequest = (r: { url(): string }) => { if (isApi(r.url())) { inFlight++; last = Date.now(); } };
    const onDone = (r: { url(): string }) => { if (isApi(r.url())) { inFlight = Math.max(0, inFlight - 1); last = Date.now(); } };
    this.page.on("request", onRequest);
    this.page.on("requestfinished", onDone);
    this.page.on("requestfailed", onDone);
    try {
      const deadline = Date.now() + timeoutMs;
      while (inFlight > 0 || Date.now() - last < quietMs) {
        if (Date.now() > deadline) throw new Error(`La app no dejó de hacer peticiones en ${timeoutMs} ms`);
        await this.page.waitForTimeout(100);
      }
    } finally {
      this.page.off("request", onRequest);
      this.page.off("requestfinished", onDone);
      this.page.off("requestfailed", onDone);
    }
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

  async expectToast(text: string | RegExp) {
    await expect(this.toast.filter({ hasText: text })).toBeVisible();
  }
}
