import { z } from "zod";
import { join } from "path";

export const DEFAULT_NAME = "default";
export const RATCHET_DIR = "ratchet";

export function ratchetDir(name: string = DEFAULT_NAME): string {
  return join(RATCHET_DIR, name);
}

export function ratchetMdPath(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), "RATCHET.md");
}

export function scorerShPath(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), "scorer.sh");
}

export function watermarkPath(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), "watermark.txt");
}

export function progressLogPath(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), "progress.log");
}

export function labeledSetPath(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), "labeled_set.json");
}

export function bestDir(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), "best");
}

export function pauseFilePath(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), ".paused");
}

export function snapshotsDir(name: string = DEFAULT_NAME): string {
  return join(ratchetDir(name), "snapshots");
}

// Legacy constants for backwards compat (map to default name)
export const RATCHET_MD = ratchetMdPath();
export const SCORER_SH = scorerShPath();
export const WATERMARK_FILE = watermarkPath();
export const PROGRESS_LOG = progressLogPath();
export const LABELED_SET = labeledSetPath();
export const BEST_DIR = bestDir();
export const PAUSE_FILE = pauseFilePath();
export const SNAPSHOTS_DIR = snapshotsDir();

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
