import * as path from "path";

// Antes de cada ejecución se deja el staging en un estado conocido (usuarios QA + seed).
// El reset vive en ivan-qa-lab-shared (en CI se clona en ./shared; en local, enlace simbólico).
export default async function globalSetup() {
  if (!process.env.STG_URL || !process.env.STG_SECRET_KEY) {
    console.warn("[global-setup] Sin STG_URL/STG_SECRET_KEY: no se resetea el staging.");
    return;
  }
  const { reset } = require(path.resolve(__dirname, "shared/reset-staging/reset.js"));
  await reset({ log: (msg: string) => console.log(`[reset-staging] ${msg}`) });
}
