import { z } from "zod";
import { join } from "path";

export const RATCHET_DIR = "ratchet";
export const RATCHET_MD = "RATCHET.md";
export const SCORER_SH = "scorer.sh";
export const WATERMARK_FILE = join(RATCHET_DIR, "watermark.txt");
export const PROGRESS_LOG = join(RATCHET_DIR, "progress.log");
export const LABELED_SET = join(RATCHET_DIR, "labeled_set.json");
export const BEST_DIR = join(RATCHET_DIR, "best");
export const PAUSE_FILE = join(RATCHET_DIR, ".paused");
export const SNAPSHOTS_DIR = join(RATCHET_DIR, "snapshots");

export const RatchetMdSchema = z.object({
  goal: z.string().min(1),
  lever: z.string().min(1),
  constraints: z.array(z.string()).optional(),
  context: z.array(z.string()).optional(),
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

  // Extract lever path from the lever section
  const leverText = (sections["lever"] || "").trim();
  const leverMatch = leverText.match(/(?:file|path)\s+(?:at\s+)?(\S+)/i);
  const leverPath = leverMatch ? leverMatch[1]! : leverText.split("\n")[0]?.trim() || "";

  return RatchetMdSchema.parse({
    goal: (sections["goal"] || "").trim(),
    lever: leverPath,
    constraints: parseList(sections["constraints"]),
    context: parseList(sections["context"]),
  });
}
