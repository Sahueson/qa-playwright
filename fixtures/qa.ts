import { test as base, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { AppPage } from "../pages/app-page";

// Usuarios QA: la fuente única es users.json de ivan-qa-lab-shared (el mismo que usa el reset).
type QaUser = { key: string; email: string; nickname: string };
const users: QaUser[] = require(path.resolve(__dirname, "../shared/reset-staging/users.json"));

export type UserKey =
  | "superadmin" | "admin_mad" | "admin_foe" | "junta2"
  | "player_foe" | "player_mad" | "blocked" | "sinequipo";

// Vuelve a dejar el staging como el seed. La ejecución ya tiene la reserva (global-setup), así
// que es seguro: úsalo en beforeAll de las suites cuyos datos dependen de otras (p. ej. el %
// de asistencia cambia si la suite B cancela una partida "contando asistencia").
export async function resetStaging() {
  const { reset } = require(path.resolve(__dirname, "../shared/reset-staging/reset.js"));
  await reset({ log: () => {} });
}

export function qaUser(key: UserKey): QaUser {
  const user = users.find((u) => u.key === key);
  if (!user) throw new Error(`Usuario QA desconocido: ${key}`);
  return user;
}

type Fixtures = {
  // Automático: captura JPEG de la pantalla al terminar cada test (pase o falle). Es la única
  // evidencia que se publica: nunca trazas ni vídeos, que llevan la contraseña QA y tokens.
  evidence: void;
  app: AppPage;
  // Entra con un usuario QA y anota su rol en el resultado (columna "role" de la web).
  loginAs: (key: UserKey) => Promise<QaUser>;
};

export const test = base.extend<Fixtures>({
  evidence: [
    async ({ page }, use, testInfo) => {
      await use();
      const file = testInfo.outputPath("evidencia.jpg");
      await page.screenshot({ path: file, type: "jpeg", quality: 60 }).catch(() => {});
      if (fs.existsSync(file)) {
        await testInfo.attach("evidencia", { path: file, contentType: "image/jpeg" });
        fs.unlinkSync(file); // attach() ya la ha copiado a los adjuntos del test
      }
    },
    { auto: true },
  ],
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
      // Espera a que termine la carga inicial de datos. (La app cargaba dos veces tras el login y
      // la 2ª pisaba cambios recién guardados: corregido en cbf909b; TC-B02/B02b lo vigilan.)
      await app.waitForQuietNetwork();
      return user;
    });
  },
});

export { expect };
