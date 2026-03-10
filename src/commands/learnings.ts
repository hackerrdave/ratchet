import { readLearnings } from "../lib/learnings.ts";
import { DEFAULT_NAME } from "../lib/config.ts";

export async function learningsCommand(options: { name: string }) {
  const cwd = process.cwd();
  const name = options.name;
  const learnings = await readLearnings(cwd, name);

  if (!learnings) {
    const nameLabel = name !== DEFAULT_NAME ? ` for "${name}"` : "";
    console.log(`No learnings yet${nameLabel}. Run \`ratchet start\` to generate them.`);
    return;
  }

  console.log(learnings);
}
