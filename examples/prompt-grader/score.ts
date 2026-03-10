#!/usr/bin/env bun
/**
 * Scorer for the prompt-grader example.
 * 
 * Reads the prompt template, runs it against test cases using Claude,
 * and scores based on:
 *   - Correct sentiment classification (70% weight)
 *   - Valid JSON output (15% weight)  
 *   - Presence of confidence field with valid 0-1 value (15% weight)
 */

import Anthropic from "@anthropic-ai/sdk";

const PROMPT_PATH = "examples/prompt-grader/prompt.md";
const TEST_CASES_PATH = "examples/prompt-grader/test_cases.json";
const MODEL = "claude-haiku-4-5-20251001";

interface TestCase {
  review: string;
  expected: string;
}

async function main() {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY required");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  const promptTemplate = await Bun.file(PROMPT_PATH).text();
  const testCases: TestCase[] = JSON.parse(await Bun.file(TEST_CASES_PATH).text());

  let correctSentiment = 0;
  let validJson = 0;
  let validConfidence = 0;
  const total = testCases.length;

  for (const tc of testCases) {
    const prompt = promptTemplate.replace("{{review}}", tc.review);

    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        validJson++;
        try {
          const parsed = JSON.parse(jsonMatch[0]);

          // Check sentiment
          const sentiment = (parsed.sentiment || "").toLowerCase().trim();
          if (sentiment === tc.expected) {
            correctSentiment++;
          }

          // Check confidence
          const conf = parseFloat(parsed.confidence);
          if (!isNaN(conf) && conf >= 0 && conf <= 1) {
            validConfidence++;
          }
        } catch {
          // JSON parse failed even though we found braces
        }
      }
    } catch (err) {
      // API error — skip this case
      console.error(`Error on "${tc.review.slice(0, 30)}...": ${err}`);
    }
  }

  // Weighted score
  const sentimentScore = correctSentiment / total;
  const jsonScore = validJson / total;
  const confidenceScore = validConfidence / total;

  const finalScore = sentimentScore * 0.7 + jsonScore * 0.15 + confidenceScore * 0.15;

  // Print breakdown to stderr for debugging
  console.error(`Sentiment: ${correctSentiment}/${total} (${(sentimentScore * 100).toFixed(1)}%)`);
  console.error(`Valid JSON: ${validJson}/${total} (${(jsonScore * 100).toFixed(1)}%)`);
  console.error(`Valid confidence: ${validConfidence}/${total} (${(confidenceScore * 100).toFixed(1)}%)`);
  console.error(`Weighted score: ${finalScore.toFixed(4)}`);

  // Print final score to stdout (this is what ratchet reads)
  console.log(finalScore.toFixed(4));
}

main();
