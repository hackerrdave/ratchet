import { z } from "zod";

/** All ratchet output lives in .ratchet/ alongside the user's RATCHET.md */
export const OUTPUT_DIR = ".ratchet";

/** RATCHET.md lives in cwd (user-authored) */
export const RATCHET_MD = "RATCHET.md";

/** Output paths (all under .ratchet/) */
export const WATERMARK_FILE = `${OUTPUT_DIR}/watermark.txt`;
export const PROGRESS_LOG = `${OUTPUT_DIR}/progress.log`;
export const BEST_DIR = `${OUTPUT_DIR}/best`;
export const PAUSE_FILE = `${OUTPUT_DIR}/.paused`;
export const SNAPSHOTS_DIR = `${OUTPUT_DIR}/snapshots`;
export const LEARNINGS_FILE = `${OUTPUT_DIR}/learnings.md`;
export const STATE_FILE = `${OUTPUT_DIR}/state.json`;

// Efficiency phase defaults
export const EFFICIENCY_DEFAULTS = {
  qualityBar: 0.85,
  qualityMargin: 0.03,
  minTokenReduction: 0.10,
  iterations: 10,
} as const;

// Approximate cost per token (USD) by model family.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus":   { input: 15 / 1_000_000, output: 75 / 1_000_000 },
  "claude-sonnet": { input: 3 / 1_000_000,  output: 15 / 1_000_000 },
  "claude-haiku":  { input: 0.80 / 1_000_000, output: 4 / 1_000_000 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const family = Object.keys(MODEL_PRICING).find((key) => model.includes(key.replace("claude-", "")));
  const pricing = family ? MODEL_PRICING[family]! : MODEL_PRICING["claude-haiku"]!;
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

export const RatchetMdSchema = z.object({
  goal: z.string().min(1),
  prompt: z.string().min(1),
  constraints: z.array(z.string()).optional(),
  context: z.array(z.string()).optional(),
  eval: z.object({
    testCases: z.string().min(1),
    /** The model this prompt is designed for. Runs test cases + judges output. */
    target: z.string().optional(),
    criteria: z.array(z.string()).min(1),
  }),
});

export type RatchetMdConfig = z.infer<typeof RatchetMdSchema>;

export function parseRatchetMd(content: string): RatchetMdConfig {
  const sections: Record<string, string> = {};
  let currentSection = "";

  for (const line of content.split("\n")) {
    const heading = line.match(/^#\s+(.+)/);
    if (heading) {
      currentSection = heading[1]!.toLowerCase().trim();
      continue;
    }
    if (currentSection) {
      sections[currentSection] = (sections[currentSection] || "") + line + "\n";
    }
  }

  const parseList = (text: string | undefined): string[] => {
    if (!text) return [];
    return text
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  };

  // Parse prompt path
  const promptText = (sections["prompt"] || "").trim();
  const promptMatch = promptText.match(/(?:file|path)\s+(?:at\s+)?(\S+)/i);
  const promptPath = promptMatch ? promptMatch[1]! : promptText.split("\n")[0]?.trim() || "";

  // Parse eval section
  const evalLines = parseList(sections["eval"]);
  let testCasesPath = "";
  let target: string | undefined;
  const criteria: string[] = [];

  for (const line of evalLines) {
    const tcMatch = line.match(/^test\s*cases?\s*:\s*(\S+)/i);
    if (tcMatch) {
      testCasesPath = tcMatch[1]!;
      continue;
    }
    const targetMatch = line.match(/^(?:target|model)\s*:\s*(\S+)/i);
    if (targetMatch) {
      target = targetMatch[1]!;
      continue;
    }
    // Everything else is a criterion
    criteria.push(line);
  }

  return RatchetMdSchema.parse({
    goal: (sections["goal"] || "").trim(),
    prompt: promptPath,
    constraints: parseList(sections["constraints"]),
    context: parseList(sections["context"]),
    eval: {
      testCases: testCasesPath,
      target,
      criteria,
    },
  });
}
