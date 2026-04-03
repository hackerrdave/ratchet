import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readProgressLog, appendProgress, snapshotLever, type ProgressEntry } from "../src/lib/progress.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "ratchet-test-"));
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

describe("readProgressLog", () => {
  test("returns empty array when no log exists", async () => {
    const result = await readProgressLog(tmpDir);
    expect(result).toEqual([]);
  });

  test("reads single entry", async () => {
    const entry = makeEntry();
    await Bun.write(join(tmpDir, ".ratchet/progress.log"), JSON.stringify(entry) + "\n");
    const result = await readProgressLog(tmpDir);
    expect(result).toHaveLength(1);
    expect(result[0]!.score).toBe(0.85);
  });

  test("reads multiple entries", async () => {
    const e1 = makeEntry({ iteration: 1 });
    const e2 = makeEntry({ iteration: 2, score: 0.90 });
    await Bun.write(
      join(tmpDir, ".ratchet/progress.log"),
      JSON.stringify(e1) + "\n" + JSON.stringify(e2) + "\n"
    );
    const result = await readProgressLog(tmpDir);
    expect(result).toHaveLength(2);
  });
});

describe("appendProgress", () => {
  test("creates log file if it doesn't exist", async () => {
    const entry = makeEntry();
    await appendProgress(tmpDir, entry);
    const result = await readProgressLog(tmpDir);
    expect(result).toHaveLength(1);
  });

  test("appends to existing log", async () => {
    await appendProgress(tmpDir, makeEntry({ iteration: 1 }));
    await appendProgress(tmpDir, makeEntry({ iteration: 2 }));
    const result = await readProgressLog(tmpDir);
    expect(result).toHaveLength(2);
  });
});

describe("snapshotLever", () => {
  test("snapshots a single file", async () => {
    await Bun.write(join(tmpDir, "prompt.md"), "Hello world");
    await snapshotLever(tmpDir, "prompt.md", 1);
    const snapshot = await Bun.file(join(tmpDir, ".ratchet/snapshots/1/prompt.md")).text();
    expect(snapshot).toBe("Hello world");
  });

  test("creates snapshot for correct iteration number", async () => {
    await Bun.write(join(tmpDir, "prompt.md"), "Iteration 5");
    await snapshotLever(tmpDir, "prompt.md", 5);
    const exists = await Bun.file(join(tmpDir, ".ratchet/snapshots/5/prompt.md")).exists();
    expect(exists).toBe(true);
  });
});
