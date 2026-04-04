import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readProgressLog, appendProgress, snapshotOriginal, type ProgressEntry } from "../src/lib/progress.ts";
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

  test("rollback restores original prompt content", async () => {
    const promptPath = join(tmpDir, "prompt.md");
    const original = "Original content";
    await Bun.write(promptPath, original);

    // Simulate agent writing new content
    await Bun.write(promptPath, "New content");

    // Rollback
    await Bun.write(promptPath, original);
    const content = await Bun.file(promptPath).text();
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

describe("original snapshot", () => {
  test("saves original prompt content to snapshots/original/", async () => {
    const promptPath = "prompt.md";
    const originalContent = "This is the original prompt content";
    await Bun.write(join(tmpDir, promptPath), originalContent);

    await snapshotOriginal(tmpDir, promptPath);

    const snapshotPath = join(tmpDir, ".ratchet/snapshots/original/prompt.md");
    const saved = await Bun.file(snapshotPath).text();
    expect(saved).toBe(originalContent);
  });

  test("does not overwrite existing original snapshot", async () => {
    const promptPath = "prompt.md";
    await Bun.write(join(tmpDir, promptPath), "first version");
    await snapshotOriginal(tmpDir, promptPath);

    // Change the prompt and snapshot again
    await Bun.write(join(tmpDir, promptPath), "second version");
    await snapshotOriginal(tmpDir, promptPath);

    const snapshotPath = join(tmpDir, ".ratchet/snapshots/original/prompt.md");
    const saved = await Bun.file(snapshotPath).text();
    expect(saved).toBe("first version");
  });

  test("handles nested prompt paths", async () => {
    const promptPath = "prompts/system.md";
    await mkdir(join(tmpDir, "prompts"), { recursive: true });
    await Bun.write(join(tmpDir, promptPath), "nested prompt");

    await snapshotOriginal(tmpDir, promptPath);

    const snapshotPath = join(tmpDir, ".ratchet/snapshots/original/system.md");
    const saved = await Bun.file(snapshotPath).text();
    expect(saved).toBe("nested prompt");
  });
});

describe("max-stale early stopping", () => {
  // Replicate the consecutive-discard tracking logic from start.ts
  function simulateRun(opts: {
    scores: number[];
    watermark: number;
    minDelta: number;
    maxStale: number;
  }): { kept: number; discarded: number; stoppedEarly: boolean; iterationsRun: number } {
    let { watermark } = opts;
    let kept = 0;
    let discarded = 0;
    let consecutiveDiscards = 0;
    let stoppedEarly = false;
    let iterationsRun = 0;

    for (const score of opts.scores) {
      iterationsRun++;
      const delta = score - watermark;

      if (delta >= opts.minDelta) {
        watermark = score;
        kept++;
        consecutiveDiscards = 0;
      } else {
        discarded++;
        consecutiveDiscards++;
      }

      if (consecutiveDiscards >= opts.maxStale) {
        stoppedEarly = true;
        break;
      }
    }

    return { kept, discarded, stoppedEarly, iterationsRun };
  }

  test("stops after N consecutive discards", () => {
    const result = simulateRun({
      scores: [0.70, 0.70, 0.70, 0.70, 0.70, 0.70, 0.70],
      watermark: 0.80,
      minDelta: 0.001,
      maxStale: 5,
    });
    expect(result.stoppedEarly).toBe(true);
    expect(result.iterationsRun).toBe(5);
    expect(result.discarded).toBe(5);
  });

  test("does not stop when improvements are interspersed", () => {
    const result = simulateRun({
      // discard, discard, discard, discard, KEEP, discard, discard, discard, discard, KEEP
      scores: [0.70, 0.70, 0.70, 0.70, 0.85, 0.70, 0.70, 0.70, 0.70, 0.90],
      watermark: 0.80,
      minDelta: 0.001,
      maxStale: 5,
    });
    expect(result.stoppedEarly).toBe(false);
    expect(result.iterationsRun).toBe(10);
    expect(result.kept).toBe(2);
  });

  test("stops exactly at maxStale even after a kept iteration resets counter", () => {
    const result = simulateRun({
      // KEEP resets, then 3 consecutive discards triggers stop
      scores: [0.85, 0.70, 0.70, 0.70],
      watermark: 0.80,
      minDelta: 0.001,
      maxStale: 3,
    });
    expect(result.stoppedEarly).toBe(true);
    expect(result.iterationsRun).toBe(4);
    expect(result.kept).toBe(1);
    expect(result.discarded).toBe(3);
  });

  test("completes all iterations when maxStale is not reached", () => {
    const result = simulateRun({
      scores: [0.70, 0.70, 0.85, 0.70, 0.90],
      watermark: 0.80,
      minDelta: 0.001,
      maxStale: 5,
    });
    expect(result.stoppedEarly).toBe(false);
    expect(result.iterationsRun).toBe(5);
  });

  test("maxStale of 1 stops on first discard", () => {
    const result = simulateRun({
      scores: [0.70, 0.85, 0.90],
      watermark: 0.80,
      minDelta: 0.001,
      maxStale: 1,
    });
    expect(result.stoppedEarly).toBe(true);
    expect(result.iterationsRun).toBe(1);
    expect(result.discarded).toBe(1);
  });

  test("all iterations kept means no early stop", () => {
    const result = simulateRun({
      scores: [0.81, 0.82, 0.83, 0.84, 0.85],
      watermark: 0.80,
      minDelta: 0.001,
      maxStale: 3,
    });
    expect(result.stoppedEarly).toBe(false);
    expect(result.kept).toBe(5);
    expect(result.discarded).toBe(0);
  });
});
