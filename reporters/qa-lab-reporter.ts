import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import * as fs from "fs";
import * as path from "path";

const enabled = !!process.env.RUN_ID && !!process.env.SUPABASE_URL;
const shared = enabled
  ? require(path.resolve(__dirname, "../shared/send-to-supabase.js"))
  : null;

class QALabReporter implements Reporter {
  private startedAt = new Date();
  private tests: any[] = [];
  private pending: Promise<unknown>[] = [];

  private send(type: string, message: string) {
    if (!shared) return;
    this.pending.push(shared.sendEvent(type, message).catch(() => {}));
  }

  onTestBegin(test: TestCase) {
    this.send("test_started", test.title);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const status =
      result.status === "passed" ? "passed" :
      result.status === "skipped" ? "skipped" : "failed";
    const role = test.annotations.find((a) => a.type === "role")?.description ?? null;

    this.tests.push({
      name: test.title,
      status,
      duration_ms: Math.round(result.duration),
      role,
      error: result.error?.message?.split("\n")[0] ?? null,
      evidence_url: null,
    });
    this.send(status === "failed" ? "test_failed" : "test_passed", test.title);
  }

  async onEnd() {
    await Promise.all(this.pending);
    const finishedAt = new Date();
    const count = (s: string) => this.tests.filter((t) => t.status === s).length;

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
          total: this.tests.length,
          passed: count("passed"),
          failed: count("failed"),
          skipped: count("skipped"),
        },
        tests: this.tests,
      }, null, 2)
    );
  }
}

export default QALabReporter;