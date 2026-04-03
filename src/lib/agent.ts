import Anthropic from "@anthropic-ai/sdk";
import { parseRatchetMd, RATCHET_MD, PROGRESS_LOG, LEARNINGS_FILE } from "./config.ts";
import { countTokens } from "./tokens.ts";
import { join } from "path";

const MAX_TOKENS = 4096;

export interface AgentResult {
  newContent: string;
  summary: string;
  inputTokens: number;
  outputTokens: number;
}

export async function runAgent(cwd: string, model: string): Promise<AgentResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  const client = new Anthropic({ apiKey });

  const ratchetMd = await Bun.file(join(cwd, RATCHET_MD)).text();
  const config = parseRatchetMd(ratchetMd);

  // Read current prompt state
  const promptPath = join(cwd, config.prompt);
  const promptContent = await Bun.file(promptPath).text();

  // Read progress log
  let progressLog = "";
  try {
    progressLog = await Bun.file(join(cwd, PROGRESS_LOG)).text();
  } catch {
    progressLog = "(no iterations yet)";
  }

  // Read learnings from previous runs
  let learnings = "";
  try {
    learnings = await Bun.file(join(cwd, LEARNINGS_FILE)).text();
  } catch {
    learnings = "";
  }

  // Read any context files mentioned in RATCHET.md
  const contextSections: string[] = [];
  if (config.context) {
    for (const ctx of config.context) {
      const pathMatch = ctx.match(/(?:Read\s+)?(\S+\.\w+)/i);
      if (pathMatch) {
        try {
          const content = await Bun.file(join(cwd, pathMatch[1]!)).text();
          contextSections.push(`--- ${pathMatch[1]} ---\n${content}`);
        } catch {}
      }
    }
  }

  const systemPrompt = `You are an optimization agent. Your job is to make exactly ONE targeted improvement to the prompt file.

RULES:
- Make exactly ONE change. Do not rewrite the entire file.
- The change should be targeted and incremental.
- Consider what has been tried before (see progress log) and try something different.
- Apply the tactical learnings from previous runs if available.
- Your response MUST contain exactly two sections:
  1. <summary> — A one-line description of what you changed and why
  2. <prompt> — The complete new content of the prompt file

Format your response exactly like this:
<summary>
Your one-line summary here
</summary>
<prompt>
The complete new content of the prompt file
</prompt>`;

  const userPrompt = `# Optimization Spec
${ratchetMd}

# Current Prompt (${config.prompt})
${promptContent}

# Progress Log
${progressLog}

${contextSections.length > 0 ? "# Context Files\n" + contextSections.join("\n\n") : ""}

${learnings ? `# Learnings from Previous Runs\n${learnings}\n` : ""}
Make exactly one targeted improvement to the prompt. Consider what has already been tried and avoid repeating failed approaches.`;

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const summaryMatch = text.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const promptMatch = text.match(/<prompt>\s*([\s\S]*?)\s*<\/prompt>/);

  if (!promptMatch) {
    throw new Error("Agent response did not contain a <prompt> block");
  }

  return {
    newContent: promptMatch[1]!,
    summary: summaryMatch ? summaryMatch[1]!.trim() : "No summary provided",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

export interface CompressAgentOptions {
  qualityBar: number;
  qualityMargin: number;
  currentTokens: number;
}

export async function runCompressAgent(
  cwd: string,
  model: string,
  compressOpts: CompressAgentOptions,
): Promise<AgentResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  const client = new Anthropic({ apiKey });

  const ratchetMd = await Bun.file(join(cwd, RATCHET_MD)).text();
  const config = parseRatchetMd(ratchetMd);
  const promptPath = join(cwd, config.prompt);
  const promptContent = await Bun.file(promptPath).text();

  let progressLog = "";
  try {
    progressLog = await Bun.file(join(cwd, PROGRESS_LOG)).text();
  } catch {
    progressLog = "(no iterations yet)";
  }

  let learnings = "";
  try {
    learnings = await Bun.file(join(cwd, LEARNINGS_FILE)).text();
  } catch {
    learnings = "";
  }

  const contextSections: string[] = [];
  if (config.context) {
    for (const ctx of config.context) {
      const pathMatch = ctx.match(/(?:Read\s+)?(\S+\.\w+)/i);
      if (pathMatch) {
        try {
          const content = await Bun.file(join(cwd, pathMatch[1]!)).text();
          contextSections.push(`--- ${pathMatch[1]} ---\n${content}`);
        } catch {}
      }
    }
  }

  const systemPrompt = `You are a token-efficiency optimization agent. Your job is to make the prompt file MORE CONCISE while preserving its quality/effectiveness.

CURRENT STATUS:
- Current token count: ${compressOpts.currentTokens} tokens
- Quality bar: ${compressOpts.qualityBar.toFixed(4)}
- Acceptable quality range: ${(compressOpts.qualityBar - compressOpts.qualityMargin).toFixed(4)} to ${compressOpts.qualityBar.toFixed(4)}+
- Quality margin: ${compressOpts.qualityMargin.toFixed(4)} (quality can drop by this much if tokens decrease substantially)

RULES:
- Make exactly ONE compression/efficiency change.
- Focus on reducing token count while preserving meaning and quality.
- Techniques: remove redundancy, tighten wording, merge overlapping instructions, eliminate filler, use terser phrasing, consolidate examples.
- Do NOT remove critical information — compress it.
- A small quality dip (within the margin) is acceptable if token savings are substantial (>10%).
- Your response MUST contain exactly two sections:
  1. <summary> — A one-line description of what you compressed and estimated token savings
  2. <prompt> — The complete new content of the prompt file

Format your response exactly like this:
<summary>
Your one-line summary here
</summary>
<prompt>
The complete new content of the prompt file
</prompt>`;

  const userPrompt = `# Optimization Spec
${ratchetMd}

# Current Prompt (${config.prompt}) — ${compressOpts.currentTokens} tokens
${promptContent}

# Progress Log (efficiency phase)
${progressLog}

${contextSections.length > 0 ? "# Context Files\n" + contextSections.join("\n\n") : ""}

${learnings ? `# Learnings from Previous Runs\n${learnings}\n` : ""}
Compress the prompt to use fewer tokens while keeping quality above ${(compressOpts.qualityBar - compressOpts.qualityMargin).toFixed(4)}. Current token count: ${compressOpts.currentTokens}. Aim for at least 10% token reduction.`;

  const response = await client.messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const summaryMatch = text.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const promptMatch = text.match(/<prompt>\s*([\s\S]*?)\s*<\/prompt>/);

  if (!promptMatch) {
    throw new Error("Agent response did not contain a <prompt> block");
  }

  return {
    newContent: promptMatch[1]!,
    summary: summaryMatch ? summaryMatch[1]!.trim() : "No summary provided",
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}
