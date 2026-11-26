import type { FullConfig, Reporter, Suite, TestCase, TestResult } from "@playwright/test/reporter";
import * as fs from "fs";
import * as path from "path";

const enabled = !!process.env.RUN_ID && !!process.env.SUPABASE_URL;
const shared = enabled
  ? require(path.resolve(__dirname, "../shared/send-to-supabase.js"))
  : null;

// Los mensajes de expect() vienen coloreados para la terminal; en la web serían basura.
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");
// Defensa extra: si la contraseña QA apareciera en un error, no se publica.
const redact = (s: string) => {
  const pwd = process.env.QA_PASSWORD;
  return pwd ? s.split(pwd).join("***") : s;
};
const firstLine = (msg?: string) => (msg ? redact(stripAnsi(msg).split("\n")[0]) : null);
// Nombre de fichero estable y legible para la evidencia de cada test.
const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

type NormalizedTest = {
  name: string;
  status: "passed" | "failed" | "skipped";
  duration_ms: number;
  role: string | null;
  error: string | null;
  evidence_url: string | null;
};

class QALabReporter implements Reporter {
  private startedAt = new Date();
  // Clave = test.id: con reintentos en CI, cada intento sobrescribe al anterior y
  // solo cuenta el resultado final (un test "flaky" que acaba pasando cuenta como passed).
  private tests = new Map<string, NormalizedTest>();
  private pending: Promise<unknown>[] = [];
  private events: Promise<unknown> = Promise.resolve();

  private send(type: string, message: string) {
    if (!shared) return;
    // En cola: los eventos se insertan en el orden en que ocurren (en paralelo podían cruzarse).
    this.events = this.events.then(() => shared.sendEvent(type, message)).catch(() => {});
    this.pending.push(this.events);
  }

  // Total de tests que se van a ejecutar: la web lo usa para la barra de progreso en vivo.
  onBegin(_config: FullConfig, suite: Suite) {
    this.send("plan", String(suite.allTests().length));
  }

  onTestBegin(test: TestCase, result: TestResult) {
    this.send("test_started", result.retry ? `${test.title} (reintento ${result.retry})` : test.title);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const outcome = test.outcome(); // expected | unexpected | flaky | skipped
    const isFinalAttempt = outcome !== "unexpected" || result.retry >= test.retries;
    if (!isFinalAttempt) return; // Playwright lo va a reintentar

    const status =
      outcome === "skipped" ? "skipped" :
      outcome === "unexpected" ? "failed" : "passed";
    // Las anotaciones añadidas en ejecución (testInfo.annotations) llegan en result.annotations.
    const annotations = [...((result as any).annotations ?? []), ...test.annotations];
    const role = annotations.find((a) => a.type === "role")?.description ?? null;

    const entry: NormalizedTest = {
      name: test.title,
      status,
      duration_ms: Math.round(result.duration),
      role,
      error: status === "failed" ? firstLine(result.error?.message) : null,
      evidence_url: null,
    };
    this.tests.set(test.id, entry);

    // Captura de fixtures/qa.ts -> bucket público `evidence` (solo en CI, con RUN_ID).
    const shot = result.attachments.find((a) => a.name === "evidencia" && a.path);
    if (shared && shot?.path && fs.existsSync(shot.path)) {
      this.pending.push(
        shared.uploadEvidence(`${slug(test.title)}.jpg`, fs.readFileSync(shot.path))
          .then((url: string) => { entry.evidence_url = url; })
          .catch((e: Error) => console.warn(`[qa-lab] No se pudo subir la evidencia de "${test.title}": ${e.message}`)),
      );
    }
    this.send(status === "failed" ? "test_failed" : status === "skipped" ? "test_skipped" : "test_passed", test.title);
    if (entry.error) this.send("log", `   ↳ ${entry.error}`);
  }

  async onEnd() {
    await Promise.all(this.pending);
    // Retención de evidencias (14 días): best-effort, nunca hace fallar la ejecución.
    if (shared) {
      await shared.pruneEvidence().catch((e: Error) => console.warn(`[qa-lab] Limpieza de evidencias: ${e.message}`));
    }
    const finishedAt = new Date();
    const tests = [...this.tests.values()];
    const count = (s: NormalizedTest["status"]) => tests.filter((t) => t.status === s).length;

    fs.writeFileSync(
      "result.json",
      JSON.stringify({
        tool: "playwright",
        target: "tactical-calendar",
        suite: process.env.SUITE ?? "local",
        started_at: this.startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - this.startedAt.getTime(),
        summary: {
          total: tests.length,
          passed: count("passed"),
          failed: count("failed"),
          skipped: count("skipped"),
        },
        tests,
      }, null, 2)
    );
  }
}

export default QALabReporter;
