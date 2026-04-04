import { PROGRESS_LOG, SNAPSHOTS_DIR } from "./config.ts";
import { join } from "path";
import { mkdir, cp } from "fs/promises";

export interface ProgressEntry {
  iteration: number;
  runId: string;
  timestamp: string;
  score: number;
  prevScore: number;
  delta: number;
  status: "kept" | "discarded";
  summary: string;
  inputTokens?: number;
  outputTokens?: number;
  cost?: number;
  /** Model used for proposing */
  model?: string;
  /** Model used for judging (if different from proposer) */
  judgeModel?: string;
  /** Token count of the prompt itself (for efficiency tracking) */
  promptTokens?: number;
  /** Phase: quality (default) or efficiency */
  phase?: "quality" | "efficiency";
  /** Token reduction percentage (efficiency phase) */
  tokenReduction?: number;
}

export async function readProgressLog(cwd: string): Promise<ProgressEntry[]> {
  const path = join(cwd, PROGRESS_LOG);
  try {
    const content = await Bun.file(path).text();
    return content
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ProgressEntry);
  } catch {
    return [];
  }
}

export async function appendProgress(cwd: string, entry: ProgressEntry): Promise<void> {
  const path = join(cwd, PROGRESS_LOG);
  const file = Bun.file(path);
  const existing = (await file.exists()) ? await file.text() : "";
  await Bun.write(path, existing + JSON.stringify(entry) + "\n");
}

export async function snapshotOriginal(
  cwd: string,
  promptPath: string,
): Promise<void> {
  const snapshotDir = join(cwd, SNAPSHOTS_DIR, "original");
  await mkdir(snapshotDir, { recursive: true });

  const sourcePath = join(cwd, promptPath);
  const filename = promptPath.split("/").pop() || "prompt";
  const destPath = join(snapshotDir, filename);

  // Only save if not already present (don't overwrite across runs)
  if (await Bun.file(destPath).exists()) return;

  if (await Bun.file(sourcePath).exists()) {
    const content = await Bun.file(sourcePath).text();
    await Bun.write(destPath, content);
  }
}

export async function snapshotPrompt(
  cwd: string,
  promptPath: string,
  iteration: number,
): Promise<void> {
  const snapshotDir = join(cwd, SNAPSHOTS_DIR, String(iteration));
  await mkdir(snapshotDir, { recursive: true });

  const sourcePath = join(cwd, promptPath);
  const stat = await Bun.file(sourcePath).exists();

  if (stat) {
    const content = await Bun.file(sourcePath).text();
    const filename = promptPath.split("/").pop() || "prompt";
    await Bun.write(join(snapshotDir, filename), content);
  } else {
    try {
      await cp(sourcePath, snapshotDir, { recursive: true });
    } catch {
      await Bun.write(join(snapshotDir, "_error.txt"), `Could not snapshot: ${promptPath}`);
    }
  }
}
