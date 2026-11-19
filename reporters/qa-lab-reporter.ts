import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import * as fs from "fs";
import * as path from "path";

const enabled = !!process.env.RUN_ID && !!process.env.SUPABASE_URL;
const shared = enabled
  ? require(path.resolve(__dirname, "../shared/send-to-supabase.js"))
  : null;

// Los mensajes de expect() vienen coloreados para la terminal; en la web serían basura.
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, "");
const firstLine = (msg?: string) => (msg ? stripAnsi(msg).split("\n")[0] : null);

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

  private send(type: string, message: string) {
    if (!shared) return;
    this.pending.push(shared.sendEvent(type, message).catch(() => {}));
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
    const role = test.annotations.find((a) => a.type === "role")?.description ?? null;

    this.tests.set(test.id, {
      name: test.title,
      status,
      duration_ms: Math.round(result.duration),
      role,
      error: status === "failed" ? firstLine(result.error?.message) : null,
      evidence_url: null,
    });
    this.send(status === "failed" ? "test_failed" : status === "skipped" ? "test_skipped" : "test_passed", test.title);
  }

  async onEnd() {
    await Promise.all(this.pending);
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
