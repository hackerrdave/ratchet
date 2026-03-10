import Anthropic from "@anthropic-ai/sdk";
import { parseRatchetMd, RATCHET_MD, PROGRESS_LOG } from "./config.ts";
import { join } from "path";

const MAX_TOKENS = 4096;

interface AgentResult {
  newContent: string;
  summary: string;
}

export async function runAgent(cwd: string, model: string): Promise<AgentResult> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  const client = new Anthropic({ apiKey });

  // Read RATCHET.md
  const ratchetMd = await Bun.file(join(cwd, RATCHET_MD)).text();
  const config = parseRatchetMd(ratchetMd);

  // Read current lever state
  const leverPath = join(cwd, config.lever);
  const leverContent = await Bun.file(leverPath).text();

  // Read progress log
  let progressLog = "";
  try {
    progressLog = await Bun.file(join(cwd, PROGRESS_LOG)).text();
  } catch {
    progressLog = "(no iterations yet)";
  }

  // Read any context files mentioned in RATCHET.md
  const contextSections: string[] = [];
  if (config.context) {
    for (const ctx of config.context) {
      // Extract file path from context line like "Read TOPOLOGY.md for codebase structure"
      const pathMatch = ctx.match(/(?:Read\s+)?(\S+\.\w+)/i);
      if (pathMatch) {
        try {
          const content = await Bun.file(join(cwd, pathMatch[1]!)).text();
          contextSections.push(`--- ${pathMatch[1]} ---\n${content}`);
        } catch {
          // File doesn't exist, skip
        }
      }
    }
  }

  const systemPrompt = `You are an optimization agent. Your job is to make exactly ONE targeted improvement to the lever file.

RULES:
- Make exactly ONE change. Do not rewrite the entire file.
- The change should be targeted and incremental.
- Consider what has been tried before (see progress log) and try something different.
- Your response MUST contain exactly two sections:
  1. <summary> — A one-line description of what you changed and why
  2. <lever> — The complete new content of the lever file

Format your response exactly like this:
<summary>
Your one-line summary here
</summary>
<lever>
The complete new content of the lever file
</lever>`;

  const userPrompt = `# Optimization Spec
${ratchetMd}

# Current Lever State (${config.lever})
${leverContent}

# Progress Log
${progressLog}

${contextSections.length > 0 ? "# Context Files\n" + contextSections.join("\n\n") : ""}

Make exactly one targeted improvement to the lever. Consider what has already been tried and avoid repeating failed approaches.`;

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

  // Parse response
  const summaryMatch = text.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const leverMatch = text.match(/<lever>\s*([\s\S]*?)\s*<\/lever>/);

  if (!leverMatch) {
    throw new Error("Agent response did not contain a <lever> block");
  }

  return {
    newContent: leverMatch[1]!,
    summary: summaryMatch ? summaryMatch[1]!.trim() : "No summary provided",
  };
}
