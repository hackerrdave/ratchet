import { join } from "path";
import { SNAPSHOTS_DIR } from "../lib/config.ts";
import { readdir } from "fs/promises";

export async function showCommand(iteration: string) {
  const cwd = process.cwd();
  const snapshotDir = join(cwd, SNAPSHOTS_DIR, iteration);

  let files: string[];
  try {
    files = await readdir(snapshotDir);
  } catch {
    console.error(`No snapshot found for iteration ${iteration}. Only kept iterations have snapshots.`);
    process.exit(1);
  }

  for (const file of files) {
    const content = await Bun.file(join(snapshotDir, file)).text();
    if (files.length > 1) {
      console.log(`--- ${file} ---`);
    }
    console.log(content);
  }
}
