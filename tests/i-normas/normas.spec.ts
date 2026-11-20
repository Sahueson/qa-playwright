import { test, expect, resetStaging } from "../../fixtures/qa";
import type { AppPage } from "../../pages/app-page";

// Suite I · Normas (documentos PDF del equipo). Desde cbf909b los PDF van a un bucket PRIVADO
// (team-documents): la app firma un enlace temporal al cargarlos. Se comprueba la subida, que el
// enlace firmado sirve el PDF, que la URL pública NO lo sirve, el borrado (fila + fichero) y
// quién puede subir y ver. El reset borra las filas y sus ficheros.

// PDF mínimo válido (una página en blanco), generado en memoria: no hace falta un fichero.
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

async function uploadStatutes(app: AppPage, title: string) {
  await app.openTab("Normas");
  await app.page.getByRole("button", { name: "+ Subir PDF" }).click();
  const form = app.page.locator("form").filter({ has: app.page.getByRole("button", { name: "Publicar PDF" }) });
  await form.locator('input[type="file"]').setInputFiles({ name: "normas-qa.pdf", mimeType: "application/pdf", buffer: PDF });
  await form.getByPlaceholder("Ej. Estatutos Oficiales FOE").fill(title);
  await form.getByRole("button", { name: "Publicar PDF" }).click();
  await app.expectToast("Documento PDF publicado correctamente.");
  await expect(form).toBeHidden();
}

test.describe("Suite I · Normas del equipo", () => {
  test.beforeAll(async () => {
    await resetStaging();
  });

  test("TC-I01 Subir unos estatutos: se ven con enlace firmado y la URL pública no los sirve", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    const title = `QA E2E · Estatutos ${Date.now()}`;
    await uploadStatutes(app, title);

    await expect(app.page.getByText(title, { exact: true }).first()).toBeVisible();
    const href = await app.page.getByRole("link", { name: "Pantalla completa" }).getAttribute("href");
    expect(href).toMatch(/\/storage\/v1\/object\/sign\/team-documents\/foe\/statutes\/.+\.pdf\?token=/);

    const signed = await app.page.request.get(href!);
    expect(signed.status()).toBe(200);
    expect((await signed.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Mismo objeto por la ruta pública (sin firma): el bucket es privado.
    const publicUrl = href!.replace("/object/sign/", "/object/public/").replace(/\?.*$/, "");
    expect((await app.page.request.get(publicUrl)).ok()).toBe(false);
  });

  test("TC-I02 Eliminar un documento borra también el fichero", async ({ app, loginAs }) => {
    // apikey y sesión con los que la propia app habla con Supabase (para preguntar a Storage).
    let apikey = "";
    app.page.on("request", (r) => { apikey ||= r.headers()["apikey"] ?? ""; });
    await loginAs("admin_foe");
    const title = `QA E2E · Estatutos a borrar ${Date.now()}`;
    await uploadStatutes(app, title);
    const href = (await app.page.getByRole("link", { name: "Pantalla completa" }).getAttribute("href"))!;

    await app.page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await app.expectToast("Documento eliminado.");
    await expect(app.page.getByText(title, { exact: true })).toHaveCount(0);

    // ¿Sigue el fichero en Storage? NO se reutiliza el enlace firmado: el visor ya lo cargó y la
    // CDN de Supabase puede seguir sirviéndolo hasta ~60 s después de borrar (falló así en CI).
    // Se pide al servidor un enlace NUEVO para esa ruta: si el fichero no existe, lo rechaza.
    const url = new URL(href);
    const objectPath = url.pathname.replace(/^.*\/object\/sign\/team-documents\//, "");
    const token = await app.page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.endsWith("-auth-token"));
      return key ? JSON.parse(localStorage.getItem(key)!).access_token : null;
    });
    expect(token).toBeTruthy();
    const resign = await app.page.request.post(`${url.origin}/storage/v1/object/sign/team-documents/${objectPath}`, {
      headers: { apikey, Authorization: `Bearer ${token}` },
      data: { expiresIn: 60 },
    });
    expect(resign.ok(), `Storage aún firma ${objectPath}: el fichero no se borró`).toBe(false);
  });

  test("TC-I03 El formulario exige título y solo acepta PDF", async ({ app, loginAs }) => {
    await loginAs("admin_foe");
    await app.openTab("Normas");
    await app.page.getByRole("button", { name: "+ Subir PDF" }).click();
    const form = app.page.locator("form").filter({ has: app.page.getByRole("button", { name: "Publicar PDF" }) });

    await form.getByRole("button", { name: "Publicar PDF" }).click();
    await expect(form.locator(".modal__error")).toHaveText("Indica un título para el documento.");

    await form.locator('input[type="file"]').setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("hola") });
    await expect(form.locator(".modal__error")).toHaveText("Solo se permiten archivos en formato PDF (.pdf).");

    await form.getByPlaceholder("Ej. Estatutos Oficiales FOE").fill("QA E2E · Sin fichero");
    await form.getByRole("button", { name: "Publicar PDF" }).click();
    await expect(form.locator(".modal__error")).toHaveText("Selecciona un archivo PDF.");
  });

  test("TC-I04 Un jugador ve las normas de su equipo pero no puede subir ni borrar", async ({ app, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs("admin_foe");
    const title = `QA E2E · Normas para jugadores ${Date.now()}`;
    await uploadStatutes(app, title);

    await loginAs("player_foe");
    await app.openTab("Normas");
    await expect(app.page.getByText(title, { exact: true }).first()).toBeVisible();
    await expect(app.page.getByRole("button", { name: "+ Subir PDF" })).toHaveCount(0);
    await expect(app.page.getByRole("button", { name: "Eliminar", exact: true })).toHaveCount(0);
  });

  test("TC-I05 Un jugador de otro equipo no ve las normas del FOE", async ({ app, loginAs }) => {
    test.setTimeout(90_000);
    await loginAs("admin_foe");
    const title = `QA E2E · Normas solo FOE ${Date.now()}`;
    await uploadStatutes(app, title);

    await loginAs("player_mad");
    await app.openTab("Normas");
    await expect(app.page.getByText("Todavía no hay estatutos o normativa publicados para MAD Irregulars.")).toBeVisible();
    await expect(app.page.locator("#doc-squad-select")).toHaveCount(0);
    await expect(app.page.getByText(title, { exact: true })).toHaveCount(0);
  });
});
