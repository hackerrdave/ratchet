import { join } from "path";
import { SNAPSHOTS_DIR } from "../lib/config.ts";
import { $ } from "bun";

export async function diffCommand(from: string, to: string) {
  const cwd = process.cwd();
  const fromDir = join(cwd, SNAPSHOTS_DIR, from);
  const toDir = join(cwd, SNAPSHOTS_DIR, to);

  try {
    await $`ls ${fromDir}`.quiet();
  } catch {
    console.error(`No snapshot found for iteration ${from}. Only kept iterations have snapshots.`);
    process.exit(1);
  }

  try {
    await $`ls ${toDir}`.quiet();
  } catch {
    console.error(`No snapshot found for iteration ${to}. Only kept iterations have snapshots.`);
    process.exit(1);
  }

  try {
    const result = await $`diff -u ${fromDir} ${toDir}`.nothrow().text();
    if (result.trim()) {
      console.log(result);
    } else {
      console.log("No differences found.");
    }
  } catch (err) {
    console.error(`Diff failed: ${err}`);
  }
}
