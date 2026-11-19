import { test as base, expect } from "@playwright/test";
import * as path from "path";
import { AppPage } from "../pages/app-page";

// Usuarios QA: la fuente única es users.json de ivan-qa-lab-shared (el mismo que usa el reset).
type QaUser = { key: string; email: string; nickname: string };
const users: QaUser[] = require(path.resolve(__dirname, "../shared/reset-staging/users.json"));

export type UserKey =
  | "superadmin" | "admin_mad" | "admin_foe" | "junta2"
  | "player_foe" | "player_mad" | "blocked" | "sinequipo";

export function qaUser(key: UserKey): QaUser {
  const user = users.find((u) => u.key === key);
  if (!user) throw new Error(`Usuario QA desconocido: ${key}`);
  return user;
}

type Fixtures = {
  app: AppPage;
  // Entra con un usuario QA y anota su rol en el resultado (columna "role" de la web).
  loginAs: (key: UserKey) => Promise<QaUser>;
};

export const test = base.extend<Fixtures>({
  app: async ({ page }, use) => {
    await use(new AppPage(page));
  },
  loginAs: async ({ app }, use, testInfo) => {
    await use(async (key) => {
      const password = process.env.QA_PASSWORD;
      if (!password) throw new Error("Falta QA_PASSWORD");
      const user = qaUser(key);
      testInfo.annotations.push({ type: "role", description: user.nickname });
      await app.goto();
      await app.login(user.email, password);
      await expect(app.loginButton).toBeHidden();
      // Tras el login, cada evento de sesión de Supabase dispara una recarga completa de datos
      // en la app (syncUserSession -> loadCloudData). Si el test actúa mientras tanto, una recarga
      // tardía puede pisar el cambio con datos viejos: se espera a que la red quede en reposo.
      await app.page.waitForLoadState("networkidle");
      return user;
    });
  },
});

export { expect };
