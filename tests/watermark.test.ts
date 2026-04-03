import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readWatermark, writeWatermark } from "../src/lib/watermark.ts";
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

describe("readWatermark", () => {
  test("returns -Infinity when no watermark file exists", async () => {
    const result = await readWatermark(tmpDir);
    expect(result).toBe(-Infinity);
  });

  test("reads a valid watermark", async () => {
    await Bun.write(join(tmpDir, ".ratchet/watermark.txt"), "0.85");
    const result = await readWatermark(tmpDir);
    expect(result).toBe(0.85);
  });

  test("reads watermark with whitespace", async () => {
    await Bun.write(join(tmpDir, ".ratchet/watermark.txt"), "  0.92  \n");
    const result = await readWatermark(tmpDir);
    expect(result).toBe(0.92);
  });

  test("handles negative scores", async () => {
    await Bun.write(join(tmpDir, ".ratchet/watermark.txt"), "-0.5");
    const result = await readWatermark(tmpDir);
    expect(result).toBe(-0.5);
  });

  test("handles zero score", async () => {
    await Bun.write(join(tmpDir, ".ratchet/watermark.txt"), "0");
    const result = await readWatermark(tmpDir);
    expect(result).toBe(0);
  });
});

describe("writeWatermark", () => {
  test("writes a watermark file", async () => {
    await writeWatermark(tmpDir, 0.95);
    const content = await Bun.file(join(tmpDir, ".ratchet/watermark.txt")).text();
    expect(content).toBe("0.95");
  });

  test("overwrites existing watermark", async () => {
    await writeWatermark(tmpDir, 0.80);
    await writeWatermark(tmpDir, 0.90);
    const content = await Bun.file(join(tmpDir, ".ratchet/watermark.txt")).text();
    expect(content).toBe("0.9");
  });
});
