import { join } from "path";
import { pauseFilePath } from "../lib/config.ts";

export async function pauseCommand(options: { name: string }) {
  const cwd = process.cwd();
  await Bun.write(join(cwd, pauseFilePath(options.name)), new Date().toISOString());
  console.log("Optimization paused. Run `ratchet resume` to continue.");
}

export async function resumeCommand(options: { name: string }) {
  const cwd = process.cwd();
  const pauseFile = join(cwd, pauseFilePath(options.name));

  if (await Bun.file(pauseFile).exists()) {
    const { unlink } = await import("fs/promises");
    await unlink(pauseFile);
    console.log("Pause flag removed. Run `ratchet start` to continue from current state.");
  } else {
    console.log("Not paused.");
  }
}
