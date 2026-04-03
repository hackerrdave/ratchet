import { describe, test, expect } from "bun:test";
import {
  parseRatchetMd,
  OUTPUT_DIR,
  RATCHET_MD,
  WATERMARK_FILE,
  PROGRESS_LOG,
  BEST_DIR,
  SNAPSHOTS_DIR,
  PAUSE_FILE,
  LEARNINGS_FILE,
} from "../src/lib/config.ts";

describe("path constants", () => {
  test("OUTPUT_DIR is .ratchet", () => {
    expect(OUTPUT_DIR).toBe(".ratchet");
  });

  test("RATCHET_MD is in cwd", () => {
    expect(RATCHET_MD).toBe("RATCHET.md");
  });

  test("output paths are under .ratchet/", () => {
    expect(WATERMARK_FILE).toBe(".ratchet/watermark.txt");
    expect(PROGRESS_LOG).toBe(".ratchet/progress.log");
    expect(BEST_DIR).toBe(".ratchet/best");
    expect(SNAPSHOTS_DIR).toBe(".ratchet/snapshots");
    expect(PAUSE_FILE).toBe(".ratchet/.paused");
    expect(LEARNINGS_FILE).toBe(".ratchet/learnings.md");
  });
});

describe("parseRatchetMd", () => {
  test("parses full RATCHET.md with eval section", () => {
    const content = `# Goal
Improve prompt accuracy for sentiment classification

# Prompt
prompt.md

# Constraints
- Must keep the {{review}} placeholder
- Must remain under 500 tokens

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correct sentiment (70%)
- Valid JSON (15%)
- Valid confidence (15%)

# Context
- Read test_cases.json to understand the test data
`;

    const result = parseRatchetMd(content);
    expect(result.goal).toBe("Improve prompt accuracy for sentiment classification");
    expect(result.prompt).toBe("prompt.md");
    expect(result.constraints).toEqual([
      "Must keep the {{review}} placeholder",
      "Must remain under 500 tokens",
    ]);
    expect(result.eval.testCases).toBe("test_cases.json");
    expect(result.eval.target).toBe("claude-haiku-4-5-20251001");
    expect(result.eval.criteria).toEqual([
      "Correct sentiment (70%)",
      "Valid JSON (15%)",
      "Valid confidence (15%)",
    ]);
    expect(result.context).toEqual([
      "Read test_cases.json to understand the test data",
    ]);
  });

  test("parses prompt with 'file at' format", () => {
    const content = `# Goal
Test

# Prompt
The file at src/prompts/main.txt is the prompt.

# Eval
- Test cases: tests.json
- Accuracy (100%)
`;
    const result = parseRatchetMd(content);
    expect(result.prompt).toBe("src/prompts/main.txt");
  });

  test("parses prompt as plain file path", () => {
    const content = `# Goal
Test

# Prompt
my/prompt.md

# Eval
- Test cases: tests.json
- Accuracy (100%)
`;
    const result = parseRatchetMd(content);
    expect(result.prompt).toBe("my/prompt.md");
  });

  test("eval target is optional", () => {
    const content = `# Goal
Test

# Prompt
prompt.md

# Eval
- Test cases: tests.json
- Accuracy (100%)
`;
    const result = parseRatchetMd(content);
    expect(result.eval.target).toBeUndefined();
    expect(result.eval.testCases).toBe("tests.json");
    expect(result.eval.criteria).toEqual(["Accuracy (100%)"]);
  });

  test("throws on missing goal", () => {
    const content = `# Prompt
prompt.md

# Eval
- Test cases: tests.json
- Accuracy (100%)
`;
    expect(() => parseRatchetMd(content)).toThrow();
  });

  test("throws on missing prompt", () => {
    const content = `# Goal
Test

# Eval
- Test cases: tests.json
- Accuracy (100%)
`;
    expect(() => parseRatchetMd(content)).toThrow();
  });

  test("throws on missing eval section", () => {
    const content = `# Goal
Test

# Prompt
prompt.md
`;
    expect(() => parseRatchetMd(content)).toThrow();
  });

  test("throws on eval without test cases", () => {
    const content = `# Goal
Test

# Prompt
prompt.md

# Eval
- Accuracy (100%)
`;
    expect(() => parseRatchetMd(content)).toThrow();
  });

  test("throws on eval without criteria", () => {
    const content = `# Goal
Test

# Prompt
prompt.md

# Eval
- Test cases: tests.json
`;
    expect(() => parseRatchetMd(content)).toThrow();
  });

  test("handles missing constraints section", () => {
    const content = `# Goal
Test

# Prompt
prompt.md

# Eval
- Test cases: tests.json
- Accuracy (100%)
`;
    const result = parseRatchetMd(content);
    expect(result.constraints).toEqual([]);
    expect(result.context).toEqual([]);
  });

  test("handles constraints with asterisk bullets", () => {
    const content = `# Goal
Test

# Prompt
prompt.md

# Eval
- Test cases: tests.json
- Accuracy (100%)

# Constraints
* Keep it short
* No profanity
`;
    const result = parseRatchetMd(content);
    expect(result.constraints).toEqual(["Keep it short", "No profanity"]);
  });

  test("parses multiple eval criteria", () => {
    const content = `# Goal
Test

# Prompt
prompt.md

# Eval
- Test cases: data/cases.json
- Target: claude-sonnet-4-20250514
- Semantic correctness (50%)
- Formatting (20%)
- Conciseness (15%)
- Tone appropriateness (15%)
`;
    const result = parseRatchetMd(content);
    expect(result.eval.testCases).toBe("data/cases.json");
    expect(result.eval.target).toBe("claude-sonnet-4-20250514");
    expect(result.eval.criteria).toHaveLength(4);
    expect(result.eval.criteria[0]).toBe("Semantic correctness (50%)");
  });
});
