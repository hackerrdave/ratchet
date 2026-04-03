import { PAUSE_FILE } from "../lib/config.ts";
import { join } from "path";

export async function pauseCommand() {
  const cwd = process.cwd();
  const path = join(cwd, PAUSE_FILE);
  await Bun.write(path, new Date().toISOString());
  console.log("Pause requested. The current iteration will complete, then the loop will stop.");
}

export async function resumeCommand() {
  const cwd = process.cwd();
  const path = join(cwd, PAUSE_FILE);
  try {
    const { unlink } = await import("fs/promises");
    await unlink(path);
    console.log("Resumed. Run `ratchet start` to continue.");
  } catch {
    console.log("Not paused.");
  }
}
