import { join } from "path";
import { PAUSE_FILE } from "../lib/config.ts";

export async function pauseCommand() {
  const cwd = process.cwd();
  await Bun.write(join(cwd, PAUSE_FILE), new Date().toISOString());
  console.log("Optimization paused. Run `ratchet resume` to continue.");
}

export async function resumeCommand() {
  const cwd = process.cwd();
  const pauseFile = join(cwd, PAUSE_FILE);

  if (await Bun.file(pauseFile).exists()) {
    const { unlink } = await import("fs/promises");
    await unlink(pauseFile);
    console.log("Pause flag removed. Run `ratchet start` to continue from current state.");
  } else {
    console.log("Not paused.");
  }
}
