import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { appendProgress, readProgressLog, type ProgressEntry } from "../src/lib/progress.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "ratchet-log-test-"));
  await mkdir(join(tmpDir, ".ratchet"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeEntry(overrides: Partial<ProgressEntry>): ProgressEntry {
  return {
    iteration: 1,
    runId: "test1234",
    timestamp: new Date().toISOString(),
    score: 0.85,
    prevScore: 0.80,
    delta: 0.05,
    status: "kept",
    summary: "test change",
    ...overrides,
  };
}

describe("token trajectory in progress log", () => {
  test("leverTokens are persisted and read back", async () => {
    const entry = makeEntry({ leverTokens: 500, phase: "quality" });
    await appendProgress(tmpDir, entry);

    const entries = await readProgressLog(tmpDir);
    expect(entries[0]!.leverTokens).toBe(500);
    expect(entries[0]!.phase).toBe("quality");
  });

  test("efficiency phase entries track tokenReduction", async () => {
    const entry = makeEntry({
      leverTokens: 400,
      phase: "efficiency",
      tokenReduction: 0.20,
    });
    await appendProgress(tmpDir, entry);

    const entries = await readProgressLog(tmpDir);
    expect(entries[0]!.tokenReduction).toBe(0.20);
    expect(entries[0]!.phase).toBe("efficiency");
  });

  test("mixed quality and efficiency entries coexist", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1, leverTokens: 1000, phase: "quality" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2, leverTokens: 1050, phase: "quality" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 3, leverTokens: 900, phase: "efficiency", tokenReduction: 0.14 }));
    await appendProgress(tmpDir, makeEntry({ iteration: 4, leverTokens: 800, phase: "efficiency", tokenReduction: 0.11 }));

    const entries = await readProgressLog(tmpDir);
    expect(entries).toHaveLength(4);

    const quality = entries.filter((e) => e.phase === "quality");
    const efficiency = entries.filter((e) => e.phase === "efficiency");
    expect(quality).toHaveLength(2);
    expect(efficiency).toHaveLength(2);

    const tokenValues = entries.map((e) => e.leverTokens);
    expect(tokenValues).toEqual([1000, 1050, 900, 800]);
  });

  test("can compute total token savings from first to last kept", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1, leverTokens: 1000, phase: "quality", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2, leverTokens: 1100, phase: "quality", status: "discarded" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 3, leverTokens: 1020, phase: "quality", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 4, leverTokens: 850, phase: "efficiency", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 5, leverTokens: 750, phase: "efficiency", status: "kept" }));

    const entries = await readProgressLog(tmpDir);
    const keptWithTokens = entries.filter(
      (e) => e.status === "kept" && e.leverTokens !== undefined
    );

    const first = keptWithTokens[0]!.leverTokens!;
    const last = keptWithTokens[keptWithTokens.length - 1]!.leverTokens!;

    expect(first).toBe(1000);
    expect(last).toBe(750);
    expect(first - last).toBe(250);
    expect(((first - last) / first) * 100).toBe(25);
  });

  test("entries without leverTokens are backwards compatible", async () => {
    const oldEntry = makeEntry({ iteration: 1 });
    delete (oldEntry as any).leverTokens;
    delete (oldEntry as any).phase;
    await appendProgress(tmpDir, oldEntry);

    await appendProgress(tmpDir, makeEntry({ iteration: 2, leverTokens: 500, phase: "quality" }));

    const entries = await readProgressLog(tmpDir);
    expect(entries[0]!.leverTokens).toBeUndefined();
    expect(entries[0]!.phase).toBeUndefined();
    expect(entries[1]!.leverTokens).toBe(500);
  });
});
