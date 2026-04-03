import Anthropic from "@anthropic-ai/sdk";
import { parseRatchetMd, RATCHET_MD, type RatchetMdConfig } from "./config.ts";
import { join } from "path";

export interface TestCase {
  /** The expected output — reserved field for the judge */
  expected: string;
  /** All other fields get substituted into the prompt as {{fieldName}} */
  [key: string]: unknown;
}

export interface JudgeResult {
  /** Aggregate score across all test cases, 0.0 - 1.0 */
  score: number;
  /** Per-test-case results */
  cases: CaseResult[];
  /** Total API tokens used by the judge */
  inputTokens: number;
  outputTokens: number;
}

export interface CaseResult {
  input: Record<string, unknown>;
  expected: string;
  actual: string;
  score: number;
  reason: string;
}

export interface JudgeOptions {
  /** The model this prompt is for. Runs test cases. Falls back to RATCHET.md Eval → Target. */
  targetModel?: string;
  /** Model to score responses. Falls back to targetModel. */
  judgeModel?: string;
}

/**
 * Run the built-in LLM judge.
 *
 * Three models in play:
 *   1. targetModel — runs the prompt-under-test against test cases (from RATCHET.md # Eval → Target)
 *   2. judgeModel  — scores each response against expected + criteria (--judge-model flag, defaults to targetModel)
 *
 * Flow per test case:
 *   1. Substitute fields into prompt template
 *   2. Run prompt against evalModel → get actual response
 *   3. Send (criteria, expected, actual) to judgeModel → get score
 *   4. Aggregate mean score
 */
export async function runJudge(cwd: string, opts: JudgeOptions = {}): Promise<JudgeResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  const client = new Anthropic({ apiKey });

  const ratchetMd = await Bun.file(join(cwd, RATCHET_MD)).text();
  const config = parseRatchetMd(ratchetMd);

  const promptTemplate = await Bun.file(join(cwd, config.prompt)).text();

  const testCasesRaw = await Bun.file(join(cwd, config.eval.testCases)).text();
  const testCases: TestCase[] = JSON.parse(testCasesRaw);

  if (testCases.length === 0) {
    throw new Error(`No test cases found in ${config.eval.testCases}`);
  }

  // Resolve models: opts override → RATCHET.md target → haiku fallback
  const defaultModel = "claude-haiku-4-5-20251001";
  const targetModel = opts.targetModel || config.eval.target || defaultModel;
  const judgeModel = opts.judgeModel || targetModel;

  const criteriaText = config.eval.criteria
    .map((c, i) => `${i + 1}. ${c}`)
    .join("\n");

  const cases: CaseResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const tc of testCases) {
    const { expected, ...inputFields } = tc;

    // Substitute all fields into the prompt template
    let prompt = promptTemplate;
    for (const [key, value] of Object.entries(inputFields)) {
      prompt = prompt.replaceAll(`{{${key}}}`, String(value));
    }

    // Step 1: Run the prompt against the eval model
    let actual: string;
    try {
      const response = await client.messages.create({
        model: targetModel,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      actual = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;
    } catch (err) {
      cases.push({
        input: inputFields,
        expected: String(expected),
        actual: `[ERROR: ${err}]`,
        score: 0,
        reason: `Prompt execution failed: ${err}`,
      });
      continue;
    }

    // Step 2: Judge the response
    const judgePrompt = `You are an eval judge. Score the following LLM response against the expected output.

## Criteria (evaluate ALL of these)
${criteriaText}

## Test case
Input: ${JSON.stringify(inputFields)}
Expected output: ${JSON.stringify(expected)}
Actual output: ${actual}

## Instructions
For each criterion, determine if it's met (1) or not (0). If the criterion has a percentage weight (e.g. "70%"), use that weight. Otherwise, weight all criteria equally.

Compute the weighted score as a single number between 0.0 and 1.0.

Respond with ONLY a JSON object, no other text:
{"score": 0.0, "reason": "one-line explanation"}`;

    try {
      const judgeResponse = await client.messages.create({
        model: judgeModel,
        max_tokens: 256,
        messages: [{ role: "user", content: judgePrompt }],
      });

      const judgeText = judgeResponse.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      totalInputTokens += judgeResponse.usage.input_tokens;
      totalOutputTokens += judgeResponse.usage.output_tokens;

      const jsonMatch = judgeText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.max(0, Math.min(1, parseFloat(parsed.score) || 0));
        cases.push({
          input: inputFields,
          expected: String(expected),
          actual,
          score,
          reason: parsed.reason || "No reason provided",
        });
      } else {
        cases.push({
          input: inputFields,
          expected: String(expected),
          actual,
          score: 0,
          reason: `Judge returned unparseable response: ${judgeText.slice(0, 100)}`,
        });
      }
    } catch (err) {
      cases.push({
        input: inputFields,
        expected: String(expected),
        actual,
        score: 0,
        reason: `Judge failed: ${err}`,
      });
    }
  }

  const score = cases.length > 0
    ? cases.reduce((sum, c) => sum + c.score, 0) / cases.length
    : 0;

  return {
    score,
    cases,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
