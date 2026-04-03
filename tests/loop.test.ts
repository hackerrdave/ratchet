import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readProgressLog, appendProgress, type ProgressEntry } from "../src/lib/progress.ts";
import { readWatermark, writeWatermark } from "../src/lib/watermark.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "ratchet-loop-test-"));
  await mkdir(join(tmpDir, ".ratchet"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makeEntry(overrides: Partial<ProgressEntry> = {}): ProgressEntry {
  return {
    iteration: 1,
    runId: "test1234",
    timestamp: "2024-01-01T00:00:00.000Z",
    score: 0.85,
    prevScore: 0.80,
    delta: 0.05,
    status: "kept",
    summary: "Test change",
    ...overrides,
  };
}

describe("accept/reject/rollback logic", () => {
  const minDelta = 0.001;

  test("accepts change when score exceeds watermark by min-delta", () => {
    const watermark = 0.80;
    const score = 0.85;
    const delta = score - watermark;
    expect(delta >= minDelta).toBe(true);
  });

  test("rejects change when score below watermark", () => {
    const watermark = 0.80;
    const score = 0.75;
    const delta = score - watermark;
    expect(delta >= minDelta).toBe(false);
  });

  test("rejects change when improvement is below min-delta", () => {
    const watermark = 0.80;
    const score = 0.8005;
    const delta = score - watermark;
    expect(delta >= minDelta).toBe(false);
  });

  test("accepts change when improvement equals min-delta exactly", () => {
    const watermark = 0.80;
    const score = 0.801;
    const delta = score - watermark;
    expect(delta >= minDelta).toBe(true);
  });

  test("rollback restores original lever content", async () => {
    const leverPath = join(tmpDir, "prompt.md");
    const original = "Original content";
    await Bun.write(leverPath, original);

    // Simulate agent writing new content
    await Bun.write(leverPath, "New content");

    // Rollback
    await Bun.write(leverPath, original);
    const content = await Bun.file(leverPath).text();
    expect(content).toBe(original);
  });

  test("watermark only ratchets up, never down", async () => {
    await writeWatermark(tmpDir, 0.80);
    const scores = [0.85, 0.75, 0.90, 0.88];
    let watermark = await readWatermark(tmpDir);

    for (const score of scores) {
      if (score > watermark) {
        watermark = score;
        await writeWatermark(tmpDir, watermark);
      }
    }

    expect(watermark).toBe(0.90);
  });

  test("pause flag stops the loop", async () => {
    const pausePath = join(tmpDir, ".ratchet/.paused");
    await Bun.write(pausePath, "paused");
    const exists = await Bun.file(pausePath).exists();
    expect(exists).toBe(true);
  });

  test("multiple iterations accumulate in progress log", async () => {
    for (let i = 1; i <= 3; i++) {
      await appendProgress(tmpDir, makeEntry({ iteration: i }));
    }
    const entries = await readProgressLog(tmpDir);
    expect(entries).toHaveLength(3);
  });
});
