import { STATE_FILE } from "./config.ts";
import { join } from "path";
import { randomBytes } from "crypto";

export function generateRunId(): string {
  return randomBytes(4).toString("hex");
}

export interface RunState {
  currentIteration: number;
  totalIterations: number;
  model: string;
  minDelta: number;
  startedAt: string;
  runId: string;
  totalSpend: number;
  maxSpend?: number;
}

export async function readState(cwd: string): Promise<RunState | null> {
  const path = join(cwd, STATE_FILE);
  try {
    const content = await Bun.file(path).text();
    return JSON.parse(content) as RunState;
  } catch {
    return null;
  }
}

export async function writeState(cwd: string, state: RunState): Promise<void> {
  const path = join(cwd, STATE_FILE);
  await Bun.write(path, JSON.stringify(state, null, 2));
}

export async function clearState(cwd: string): Promise<void> {
  const path = join(cwd, STATE_FILE);
  try {
    const { unlink } = await import("fs/promises");
    await unlink(path);
  } catch {
    // Already doesn't exist
  }
}
