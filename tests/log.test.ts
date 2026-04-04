import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { appendProgress, readProgressLog, type ProgressEntry } from "../src/lib/progress.ts";
import { computePhaseRanges } from "../src/commands/log.ts";

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
  test("promptTokens are persisted and read back", async () => {
    const entry = makeEntry({ promptTokens: 500, phase: "quality" });
    await appendProgress(tmpDir, entry);

    const entries = await readProgressLog(tmpDir);
    expect(entries[0]!.promptTokens).toBe(500);
    expect(entries[0]!.phase).toBe("quality");
  });

  test("efficiency phase entries track tokenReduction", async () => {
    const entry = makeEntry({
      promptTokens: 400,
      phase: "efficiency",
      tokenReduction: 0.20,
    });
    await appendProgress(tmpDir, entry);

    const entries = await readProgressLog(tmpDir);
    expect(entries[0]!.tokenReduction).toBe(0.20);
    expect(entries[0]!.phase).toBe("efficiency");
  });

  test("mixed quality and efficiency entries coexist", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1, promptTokens: 1000, phase: "quality" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2, promptTokens: 1050, phase: "quality" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 3, promptTokens: 900, phase: "efficiency", tokenReduction: 0.14 }));
    await appendProgress(tmpDir, makeEntry({ iteration: 4, promptTokens: 800, phase: "efficiency", tokenReduction: 0.11 }));

    const entries = await readProgressLog(tmpDir);
    expect(entries).toHaveLength(4);

    const quality = entries.filter((e) => e.phase === "quality");
    const efficiency = entries.filter((e) => e.phase === "efficiency");
    expect(quality).toHaveLength(2);
    expect(efficiency).toHaveLength(2);

    const tokenValues = entries.map((e) => e.promptTokens);
    expect(tokenValues).toEqual([1000, 1050, 900, 800]);
  });

  test("can compute total token savings from first to last kept", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1, promptTokens: 1000, phase: "quality", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2, promptTokens: 1100, phase: "quality", status: "discarded" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 3, promptTokens: 1020, phase: "quality", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 4, promptTokens: 850, phase: "efficiency", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 5, promptTokens: 750, phase: "efficiency", status: "kept" }));

    const entries = await readProgressLog(tmpDir);
    const keptWithTokens = entries.filter(
      (e) => e.status === "kept" && e.promptTokens !== undefined
    );

    const first = keptWithTokens[0]!.promptTokens!;
    const last = keptWithTokens[keptWithTokens.length - 1]!.promptTokens!;

    expect(first).toBe(1000);
    expect(last).toBe(750);
    expect(first - last).toBe(250);
    expect(((first - last) / first) * 100).toBe(25);
  });

  test("efficiency start equals quality end token count", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1, promptTokens: 1000, phase: "quality", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2, promptTokens: 1050, phase: "quality", status: "kept" }));
    // First kept efficiency entry has fewer tokens than quality end — but efficiency start should still be 1050
    await appendProgress(tmpDir, makeEntry({ iteration: 3, promptTokens: 900, phase: "efficiency", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 4, promptTokens: 800, phase: "efficiency", status: "kept" }));

    const entries = await readProgressLog(tmpDir);
    const keptWithTokens = entries.filter(
      (e) => e.status === "kept" && e.promptTokens !== undefined
    );
    const ranges = computePhaseRanges(keptWithTokens);

    expect(ranges).not.toBeNull();
    expect(ranges!.quality.start).toBe(1000);
    expect(ranges!.quality.end).toBe(1050);
    expect(ranges!.efficiency.start).toBe(1050); // Must equal quality end
    expect(ranges!.efficiency.end).toBe(800);
    expect(ranges!.quality.count).toBe(2);
    expect(ranges!.efficiency.count).toBe(2);
  });

  test("efficiency start equals quality end even with single quality entry", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1, promptTokens: 500, phase: "quality", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2, promptTokens: 400, phase: "efficiency", status: "kept" }));

    const entries = await readProgressLog(tmpDir);
    const keptWithTokens = entries.filter(
      (e) => e.status === "kept" && e.promptTokens !== undefined
    );
    const ranges = computePhaseRanges(keptWithTokens);

    expect(ranges).not.toBeNull();
    expect(ranges!.quality.start).toBe(500);
    expect(ranges!.quality.end).toBe(500);
    expect(ranges!.efficiency.start).toBe(500); // Must equal quality end
    expect(ranges!.efficiency.end).toBe(400);
  });

  test("computePhaseRanges returns null with only one phase", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1, promptTokens: 1000, phase: "quality", status: "kept" }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2, promptTokens: 1020, phase: "quality", status: "kept" }));

    const entries = await readProgressLog(tmpDir);
    const keptWithTokens = entries.filter(
      (e) => e.status === "kept" && e.promptTokens !== undefined
    );
    const ranges = computePhaseRanges(keptWithTokens);

    expect(ranges).toBeNull();
  });

  test("entries without promptTokens are backwards compatible", async () => {
    const oldEntry = makeEntry({ iteration: 1 });
    delete (oldEntry as any).promptTokens;
    delete (oldEntry as any).phase;
    await appendProgress(tmpDir, oldEntry);

    await appendProgress(tmpDir, makeEntry({ iteration: 2, promptTokens: 500, phase: "quality" }));

    const entries = await readProgressLog(tmpDir);
    expect(entries[0]!.promptTokens).toBeUndefined();
    expect(entries[0]!.phase).toBeUndefined();
    expect(entries[1]!.promptTokens).toBe(500);
  });
});
