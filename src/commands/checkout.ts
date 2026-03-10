import { join } from "path";
import { readdir } from "fs/promises";
import { snapshotsDir, ratchetMdPath, parseRatchetMd } from "../lib/config.ts";

export async function checkoutCommand(iteration: string, options: { name: string }) {
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

  // Read RATCHET.md to get lever path
  const ratchetMd = await Bun.file(join(cwd, ratchetMdPath(name))).text();
  const config = parseRatchetMd(ratchetMd);

  // Restore files
  for (const file of files) {
    const content = await Bun.file(join(snapshotDir, file)).text();
    const targetPath = join(cwd, config.lever);

    // If lever is a file, write directly. If dir, write to dir.
    const leverFile = Bun.file(targetPath);
    if (await leverFile.exists()) {
      // Single file lever
      await Bun.write(targetPath, content);
    } else {
      // Directory lever
      await Bun.write(join(targetPath, file), content);
    }
  }

  console.log(`Restored lever to iteration ${iteration} state.`);
}
