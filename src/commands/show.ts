import { join } from "path";
import { snapshotsDir } from "../lib/config.ts";
import { readdir } from "fs/promises";

export async function showCommand(iteration: string, options: { name: string }) {
  const cwd = process.cwd();
  const name = options.name;
  const snapshotDir = join(cwd, snapshotsDir(name), iteration);

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
