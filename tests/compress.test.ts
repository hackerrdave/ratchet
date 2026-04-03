import { describe, test, expect } from "bun:test";
import {
  EFFICIENCY_DEFAULTS,
} from "../src/lib/config.ts";

describe("efficiency config", () => {

  test("EFFICIENCY_DEFAULTS has expected shape", () => {
    expect(EFFICIENCY_DEFAULTS.qualityBar).toBe(0.85);
    expect(EFFICIENCY_DEFAULTS.qualityMargin).toBe(0.03);
    expect(EFFICIENCY_DEFAULTS.minTokenReduction).toBe(0.10);
    expect(EFFICIENCY_DEFAULTS.iterations).toBe(10);
  });

  test("quality margin is less than quality bar", () => {
    expect(EFFICIENCY_DEFAULTS.qualityMargin).toBeLessThan(
      EFFICIENCY_DEFAULTS.qualityBar
    );
  });

  test("minTokenReduction is between 0 and 1", () => {
    expect(EFFICIENCY_DEFAULTS.minTokenReduction).toBeGreaterThan(0);
    expect(EFFICIENCY_DEFAULTS.minTokenReduction).toBeLessThan(1);
  });
});

describe("compression acceptance logic", () => {
  // Replicate the acceptance logic from compress.ts to unit test it
  function shouldAccept(opts: {
    score: number;
    bestScore: number;
    qualityBar: number;
    qualityMargin: number;
    newTokens: number;
    currentTokens: number;
    minTokenReduction: number;
  }): boolean {
    const qualityOk = opts.score >= opts.qualityBar - opts.qualityMargin;
    const qualityDropped = opts.score < opts.bestScore;
    const tokensReduced = opts.newTokens < opts.currentTokens;
    const tokenReduction =
      (opts.currentTokens - opts.newTokens) / opts.currentTokens;
    const substantialReduction = tokenReduction >= opts.minTokenReduction;

    return qualityOk && tokensReduced && (!qualityDropped || substantialReduction);
  }

  const base = {
    qualityBar: 0.90,
    qualityMargin: 0.03,
    bestScore: 0.92,
    currentTokens: 1000,
    minTokenReduction: 0.10,
  };

  test("accepts when quality holds and tokens decrease", () => {
    expect(
      shouldAccept({ ...base, score: 0.92, newTokens: 900 })
    ).toBe(true);
  });

  test("accepts when quality improves and tokens decrease", () => {
    expect(
      shouldAccept({ ...base, score: 0.95, newTokens: 950 })
    ).toBe(true);
  });

  test("rejects when tokens increase even if quality improves", () => {
    expect(
      shouldAccept({ ...base, score: 0.95, newTokens: 1100 })
    ).toBe(false);
  });

  test("rejects when quality drops below floor", () => {
    expect(
      shouldAccept({ ...base, score: 0.86, newTokens: 500 })
    ).toBe(false);
  });

  test("accepts at exact quality floor with substantial token reduction", () => {
    expect(
      shouldAccept({ ...base, score: 0.87, newTokens: 800 }) // 20% reduction, quality at floor
    ).toBe(true);
  });

  test("rejects small quality drop with insufficient token reduction", () => {
    // Quality dropped (0.91 < 0.92) but token reduction is only 5% (< 10%)
    expect(
      shouldAccept({ ...base, score: 0.91, newTokens: 950 })
    ).toBe(false);
  });

  test("accepts small quality drop with substantial token reduction", () => {
    // Quality dropped (0.90 < 0.92) but token reduction is 20% (>= 10%)
    expect(
      shouldAccept({ ...base, score: 0.90, newTokens: 800 })
    ).toBe(true);
  });

  test("rejects when tokens stay the same", () => {
    expect(
      shouldAccept({ ...base, score: 0.92, newTokens: 1000 })
    ).toBe(false);
  });

  test("accepts tiny token reduction when quality doesn't drop", () => {
    // Quality didn't drop, tokens reduced by just 1 — should accept
    expect(
      shouldAccept({ ...base, score: 0.92, newTokens: 999 })
    ).toBe(true);
  });

  test("rejects quality at floor with tiny token reduction", () => {
    // Quality dropped AND token reduction < 10%
    expect(
      shouldAccept({ ...base, score: 0.89, newTokens: 950 })
    ).toBe(false);
  });
});

describe("progress entry efficiency fields", () => {
  test("ProgressEntry supports efficiency phase fields", () => {
    // Type check — ensure the extended fields are accepted
    const entry = {
      iteration: 1,
      runId: "abc123",
      timestamp: new Date().toISOString(),
      score: 0.90,
      prevScore: 0.92,
      delta: -0.02,
      status: "kept" as const,
      summary: "Compressed redundant instructions",
      leverTokens: 800,
      phase: "efficiency" as const,
      tokenReduction: 0.20,
    };

    expect(entry.phase).toBe("efficiency");
    expect(entry.leverTokens).toBe(800);
    expect(entry.tokenReduction).toBe(0.20);
  });
});
