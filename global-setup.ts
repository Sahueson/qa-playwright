import * as path from "path";

// Antes de cada ejecución: reserva el staging (una sola ejecución a la vez, venga de la web,
// de local o de otro agente) y lo deja en un estado conocido (usuarios QA + seed).
// La función devuelta es el global teardown de Playwright: libera la reserva al terminar.
// El código vive en ivan-qa-lab-shared (en CI se clona en ./shared; en local, enlace simbólico).
export default async function globalSetup() {
  if (!process.env.STG_URL || !process.env.STG_SECRET_KEY) {
    console.warn("[global-setup] Sin STG_URL/STG_SECRET_KEY: no se reserva ni se resetea el staging.");
    return;
  }
  const log = (msg: string) => console.log(`[staging] ${msg}`);
  const { acquireStagingLock } = require(path.resolve(__dirname, "shared/reset-staging/lock.js"));
  const { reset } = require(path.resolve(__dirname, "shared/reset-staging/reset.js"));

  // Pantalla en vivo de la web (no hace nada sin RUN_ID).
  const live = require(path.resolve(__dirname, "shared/live-events.js"));
  live.emit("log", "Reservando el entorno de pruebas (solo admite una ejecución a la vez)");
  const release: () => Promise<unknown> = await acquireStagingLock({ log });
  try {
    live.emit("log", "Restaurando los datos de prueba");
    await reset({ log });
    live.emit("log", "Entorno listo: arrancan las pruebas");
  } catch (e) {
    await release();
    throw e;
  }
  return async () => {
    await release();
    log("Staging liberado");
  };
}
