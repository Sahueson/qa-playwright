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

  const release: () => Promise<unknown> = await acquireStagingLock({ log });
  try {
    await reset({ log });
  } catch (e) {
    await release();
    throw e;
  }
  return async () => {
    await release();
    log("Staging liberado");
  };
}
