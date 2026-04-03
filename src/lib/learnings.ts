import Anthropic from "@anthropic-ai/sdk";
import { LEARNINGS_FILE, PROGRESS_LOG, RATCHET_MD } from "./config.ts";
import { join } from "path";

export async function readLearnings(cwd: string): Promise<string> {
  const path = join(cwd, LEARNINGS_FILE);
  try {
    return await Bun.file(path).text();
  } catch {
    return "";
  }
}

export async function extractLearnings(
  cwd: string,
  model: string,
): Promise<string> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) return "";

  const client = new Anthropic({ apiKey });

  let progressLog = "";
  try {
    progressLog = await Bun.file(join(cwd, PROGRESS_LOG)).text();
  } catch {
    return "";
  }

  if (!progressLog.trim()) return "";

  let ratchetMd = "";
  try {
    ratchetMd = await Bun.file(join(cwd, RATCHET_MD)).text();
  } catch {}

  const existingLearnings = await readLearnings(cwd);

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: `You extract tactical learnings from optimization run logs. Output a concise markdown document of reusable insights — what worked, what didn't, and why. These learnings should be useful tactics that generalize beyond this specific run.

Rules:
- Each learning should be a bullet point under a category heading
- Be specific and actionable, not vague
- Include the evidence (e.g., "iterations 1,3 tried X and scored lower")
- If existing learnings are provided, update them — merge new insights, remove outdated ones, keep what's still valid
- Keep it under 30 bullet points total
- Categories: ## What Works, ## What Doesn't, ## Tactics`,
    messages: [
      {
        role: "user",
        content: `# Optimization Spec
${ratchetMd}

# Progress Log
${progressLog}

${existingLearnings ? `# Existing Learnings (update these)\n${existingLearnings}` : ""}

Extract the tactical learnings from this optimization run.`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  const path = join(cwd, LEARNINGS_FILE);
  await Bun.write(path, text);

  return text;
}
