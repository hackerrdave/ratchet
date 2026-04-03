import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readState, writeState, clearState } from "../src/lib/state.ts";
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

describe("readState", () => {
  test("returns null when no state file exists", async () => {
    const result = await readState(tmpDir);
    expect(result).toBeNull();
  });

  test("reads saved state", async () => {
    const state = {
      currentIteration: 5,
      totalIterations: 20,
      model: "claude-haiku-4-5-20251001",
      minDelta: 0.001,
      startedAt: "2024-01-01T00:00:00.000Z",
      runId: "abc12345",
      totalSpend: 0.05,
    };
    await Bun.write(join(tmpDir, ".ratchet/state.json"), JSON.stringify(state));
    const result = await readState(tmpDir);
    expect(result).toEqual(state);
  });
});

describe("writeState", () => {
  test("writes state to file", async () => {
    const state = {
      currentIteration: 3,
      totalIterations: 10,
      model: "claude-haiku-4-5-20251001",
      minDelta: 0.001,
      startedAt: "2024-01-01T00:00:00.000Z",
      runId: "def67890",
      totalSpend: 0.02,
    };
    await writeState(tmpDir, state);
    const content = await Bun.file(join(tmpDir, ".ratchet/state.json")).text();
    expect(JSON.parse(content)).toEqual(state);
  });
});

describe("clearState", () => {
  test("removes state file", async () => {
    await Bun.write(join(tmpDir, ".ratchet/state.json"), "{}");
    await clearState(tmpDir);
    const exists = await Bun.file(join(tmpDir, ".ratchet/state.json")).exists();
    expect(exists).toBe(false);
  });

  test("does not throw when no state file exists", async () => {
    await clearState(tmpDir);
    // Should not throw
  });
});
