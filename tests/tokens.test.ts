import { describe, test, expect } from "bun:test";
import {
  countTokens,
  tokenize,
  getTokenStats,
  estimateLeverCostPerCall,
  type DecodedToken,
} from "../src/lib/tokens.ts";

describe("countTokens", () => {
  test("returns a positive integer for non-empty text", () => {
    const count = countTokens("Hello, world!");
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  test("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  test("longer text has more tokens", () => {
    const short = countTokens("Hi");
    const long = countTokens(
      "This is a much longer piece of text that should produce significantly more tokens than just saying hi."
    );
    expect(long).toBeGreaterThan(short);
  });

  test("single word is typically 1 token", () => {
    // Common English words are usually 1 token
    const count = countTokens("Hello");
    expect(count).toBe(1);
  });

  test("handles multi-line text", () => {
    const text = "Line one\nLine two\nLine three";
    const count = countTokens(text);
    expect(count).toBeGreaterThan(3);
  });

  test("handles special characters", () => {
    const count = countTokens("🎉🚀💡");
    expect(count).toBeGreaterThan(0);
  });

  test("JSON-heavy text tokenizes predictably", () => {
    const json = '{"sentiment": "positive", "confidence": 0.85}';
    const count = countTokens(json);
    expect(count).toBeGreaterThan(5); // JSON uses many small tokens
  });
});

describe("tokenize", () => {
  test("returns array of decoded tokens", () => {
    const tokens = tokenize("Hello world");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]).toHaveProperty("id");
    expect(tokens[0]).toHaveProperty("text");
  });

  test("tokens concatenate back to original text", () => {
    const original = "Hello, world! This is a test.";
    const tokens = tokenize(original);
    const reconstructed = tokens.map((t) => t.text).join("");
    expect(reconstructed).toBe(original);
  });

  test("token count matches countTokens", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const tokens = tokenize(text);
    const count = countTokens(text);
    expect(tokens.length).toBe(count);
  });

  test("each token has a numeric id", () => {
    const tokens = tokenize("Testing token IDs");
    for (const t of tokens) {
      expect(typeof t.id).toBe("number");
      expect(t.id).toBeGreaterThanOrEqual(0);
    }
  });

  test("each token has non-empty text", () => {
    const tokens = tokenize("Some text here");
    for (const t of tokens) {
      expect(t.text.length).toBeGreaterThan(0);
    }
  });

  test("returns empty array for empty string", () => {
    const tokens = tokenize("");
    expect(tokens).toEqual([]);
  });

  test("handles newlines as part of tokens", () => {
    const tokens = tokenize("line1\nline2");
    const reconstructed = tokens.map((t) => t.text).join("");
    expect(reconstructed).toBe("line1\nline2");
  });

  test("preserves whitespace exactly", () => {
    const original = "  indented   text  ";
    const tokens = tokenize(original);
    const reconstructed = tokens.map((t) => t.text).join("");
    expect(reconstructed).toBe(original);
  });
});

describe("getTokenStats", () => {
  test("returns token count and cost", () => {
    const stats = getTokenStats("Hello world");
    expect(stats.tokenCount).toBeGreaterThan(0);
    expect(stats.estimatedCostPerCall).toBeGreaterThan(0);
  });

  test("tokenCount matches countTokens", () => {
    const text = "Test consistency between functions";
    const stats = getTokenStats(text);
    const count = countTokens(text);
    expect(stats.tokenCount).toBe(count);
  });

  test("cost scales with token count", () => {
    const short = getTokenStats("Hi");
    const long = getTokenStats(
      "This is a significantly longer text that will have many more tokens and therefore cost more per API call."
    );
    expect(long.estimatedCostPerCall).toBeGreaterThan(
      short.estimatedCostPerCall
    );
  });
});

describe("estimateLeverCostPerCall", () => {
  test("haiku is cheapest", () => {
    const haiku = estimateLeverCostPerCall(1000, "claude-haiku-4-5-20251001");
    const sonnet = estimateLeverCostPerCall(1000, "claude-sonnet-4-20250514");
    const opus = estimateLeverCostPerCall(1000, "claude-opus-4-20250514");
    expect(haiku).toBeLessThan(sonnet);
    expect(sonnet).toBeLessThan(opus);
  });

  test("cost is zero for zero tokens", () => {
    expect(estimateLeverCostPerCall(0, "claude-haiku-4-5-20251001")).toBe(0);
  });

  test("cost is positive for positive tokens", () => {
    expect(
      estimateLeverCostPerCall(100, "claude-haiku-4-5-20251001")
    ).toBeGreaterThan(0);
  });

  test("cost scales linearly with tokens", () => {
    const cost100 = estimateLeverCostPerCall(100, "claude-haiku-4-5-20251001");
    const cost200 = estimateLeverCostPerCall(200, "claude-haiku-4-5-20251001");
    expect(cost200).toBeCloseTo(cost100 * 2, 10);
  });

  test("falls back to haiku pricing for unknown model", () => {
    const unknown = estimateLeverCostPerCall(1000, "some-unknown-model");
    const haiku = estimateLeverCostPerCall(1000, "claude-haiku-4-5-20251001");
    expect(unknown).toBe(haiku);
  });
});

describe("roundtrip fidelity", () => {
  test("prompt-like text reconstructs perfectly", () => {
    const prompt = `You are a helpful assistant. Classify the following review as positive, negative, or neutral.

Review: {{input}}

Respond with JSON: {"sentiment": "...", "confidence": 0.0}`;

    const tokens = tokenize(prompt);
    const reconstructed = tokens.map((t) => t.text).join("");
    expect(reconstructed).toBe(prompt);
    expect(tokens.length).toBe(countTokens(prompt));
  });

  test("markdown with code blocks reconstructs", () => {
    const md = `# Instructions

\`\`\`json
{"key": "value"}
\`\`\`

- Item 1
- Item 2`;

    const tokens = tokenize(md);
    const reconstructed = tokens.map((t) => t.text).join("");
    expect(reconstructed).toBe(md);
  });
});
