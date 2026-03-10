import { PROGRESS_LOG, SNAPSHOTS_DIR } from "./config.ts";
import { join } from "path";
import { mkdir, cp } from "fs/promises";

export interface ProgressEntry {
  iteration: number;
  timestamp: string;
  score: number;
  prevScore: number;
  delta: number;
  status: "kept" | "discarded";
  summary: string;
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

export async function snapshotLever(
  cwd: string,
  leverPath: string,
  iteration: number
): Promise<void> {
  const snapshotDir = join(cwd, SNAPSHOTS_DIR, String(iteration));
  await mkdir(snapshotDir, { recursive: true });

  const sourcePath = join(cwd, leverPath);
  const stat = await Bun.file(sourcePath).exists();

  if (stat) {
    // Single file
    const content = await Bun.file(sourcePath).text();
    const filename = leverPath.split("/").pop() || "lever";
    await Bun.write(join(snapshotDir, filename), content);
  } else {
    // Try as directory
    try {
      await cp(sourcePath, snapshotDir, { recursive: true });
    } catch {
      // If neither file nor dir, just note it
      await Bun.write(join(snapshotDir, "_error.txt"), `Could not snapshot: ${leverPath}`);
    }
  }
}
