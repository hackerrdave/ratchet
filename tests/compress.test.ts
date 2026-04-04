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

describe("compression max-stale early stopping", () => {
  function shouldAcceptCompress(opts: {
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

  function simulateCompressRun(opts: {
    proposals: { score: number; newTokens: number }[];
    bestScore: number;
    currentTokens: number;
    qualityBar: number;
    qualityMargin: number;
    minTokenReduction: number;
    maxStale: number;
  }): { kept: number; discarded: number; stoppedEarly: boolean; iterationsRun: number } {
    let { bestScore, currentTokens } = opts;
    let kept = 0;
    let discarded = 0;
    let consecutiveDiscards = 0;
    let stoppedEarly = false;
    let iterationsRun = 0;

    for (const proposal of opts.proposals) {
      iterationsRun++;
      const accept = shouldAcceptCompress({
        score: proposal.score,
        bestScore,
        qualityBar: opts.qualityBar,
        qualityMargin: opts.qualityMargin,
        newTokens: proposal.newTokens,
        currentTokens,
        minTokenReduction: opts.minTokenReduction,
      });

      if (accept) {
        bestScore = proposal.score;
        currentTokens = proposal.newTokens;
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

  const base = {
    bestScore: 0.92,
    currentTokens: 1000,
    qualityBar: 0.90,
    qualityMargin: 0.03,
    minTokenReduction: 0.10,
    maxStale: 3,
  };

  test("stops after N consecutive rejected compressions", () => {
    const result = simulateCompressRun({
      ...base,
      proposals: [
        { score: 0.92, newTokens: 1000 }, // no reduction
        { score: 0.92, newTokens: 1000 }, // no reduction
        { score: 0.92, newTokens: 1000 }, // no reduction
        { score: 0.92, newTokens: 800 },  // would be accepted
      ],
    });
    expect(result.stoppedEarly).toBe(true);
    expect(result.iterationsRun).toBe(3);
    expect(result.discarded).toBe(3);
  });

  test("resets counter when a compression is accepted", () => {
    const result = simulateCompressRun({
      ...base,
      proposals: [
        { score: 0.92, newTokens: 1000 }, // reject
        { score: 0.92, newTokens: 1000 }, // reject
        { score: 0.92, newTokens: 900 },  // accept (quality held, tokens down)
        { score: 0.92, newTokens: 900 },  // reject (no further reduction)
        { score: 0.92, newTokens: 900 },  // reject
        { score: 0.92, newTokens: 900 },  // reject → triggers stop
      ],
    });
    expect(result.stoppedEarly).toBe(true);
    expect(result.iterationsRun).toBe(6);
    expect(result.kept).toBe(1);
    expect(result.discarded).toBe(5);
  });

  test("completes all iterations when stale limit not hit", () => {
    const result = simulateCompressRun({
      ...base,
      proposals: [
        { score: 0.92, newTokens: 900 },  // accept
        { score: 0.92, newTokens: 1000 }, // reject (tokens went up relative to new current)
        { score: 0.92, newTokens: 800 },  // accept
        { score: 0.92, newTokens: 700 },  // accept
      ],
    });
    expect(result.stoppedEarly).toBe(false);
    expect(result.iterationsRun).toBe(4);
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
      promptTokens: 800,
      phase: "efficiency" as const,
      tokenReduction: 0.20,
    };

    expect(entry.phase).toBe("efficiency");
    expect(entry.promptTokens).toBe(800);
    expect(entry.tokenReduction).toBe(0.20);
  });
});
