import { join } from "path";
import { RATCHET_MD, SNAPSHOTS_DIR, parseRatchetMd } from "../lib/config.ts";
import { readdir } from "fs/promises";

export async function checkoutCommand(iteration: string) {
  const cwd = process.cwd();
  const snapshotDir = join(cwd, SNAPSHOTS_DIR, iteration);

  try {
    const files = await readdir(snapshotDir);
    const ratchetMd = await Bun.file(join(cwd, RATCHET_MD)).text();
    const config = parseRatchetMd(ratchetMd);

    for (const file of files) {
      const content = await Bun.file(join(snapshotDir, file)).text();
      const promptFile = config.prompt.split("/").pop() || "prompt";
      if (file === promptFile) {
        await Bun.write(join(cwd, config.prompt), content);
        console.log(`Restored ${config.prompt} to iteration ${iteration} state.`);
      }
    }
  } catch {
    console.error(`No snapshot found for iteration ${iteration}. Only kept iterations have snapshots.`);
    process.exit(1);
  }
}
