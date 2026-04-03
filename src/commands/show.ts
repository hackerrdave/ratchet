import { join } from "path";
import { SNAPSHOTS_DIR } from "../lib/config.ts";
import { readdir } from "fs/promises";

export async function showCommand(iteration: string) {
  const cwd = process.cwd();
  const snapshotDir = join(cwd, SNAPSHOTS_DIR, iteration);

  try {
    const files = await readdir(snapshotDir);
    for (const file of files) {
      const content = await Bun.file(join(snapshotDir, file)).text();
      console.log(`--- ${file} ---`);
      console.log(content);
    }
  } catch {
    console.error(`No snapshot found for iteration ${iteration}. Only kept iterations have snapshots.`);
    process.exit(1);
  }
}
