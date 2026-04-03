import { readProgressLog } from "../lib/progress.ts";
import { PROGRESS_LOG } from "../lib/config.ts";
import { join } from "path";
import { watch } from "fs";

export async function watchCommand() {
  const cwd = process.cwd();

  console.log("Watching for progress... (Ctrl+C to stop)\n");

  const render = async () => {
    const entries = await readProgressLog(cwd);
    if (entries.length === 0) return;

    // Clear and redraw
    process.stdout.write("\x1b[2J\x1b[H");
    console.log("Ratchet — live progress\n");

    const maxScore = Math.max(...entries.map((e) => e.score));
    const minScore = Math.min(...entries.map((e) => e.score));
    const range = maxScore - minScore || 0.01;
    const width = 40;

    for (const e of entries) {
      const barLen = Math.round(((e.score - minScore) / range) * width);
      const bar = "█".repeat(barLen) + "░".repeat(width - barLen);
      const icon = e.status === "kept" ? "✓" : "✗";
      console.log(`${String(e.iteration).padStart(3)} ${icon} ${bar} ${e.score.toFixed(4)}`);
    }

    const kept = entries.filter((e) => e.status === "kept").length;
    console.log(`\n${entries.length} iterations, ${kept} kept`);
  };

  await render();

  const logPath = join(cwd, PROGRESS_LOG);
  const watcher = watch(logPath, async () => {
    await render();
  });

  // Keep alive
  await new Promise(() => {});
}
