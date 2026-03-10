import { readProgressLog, type ProgressEntry } from "../lib/progress.ts";
import { readWatermark } from "../lib/watermark.ts";
import { PROGRESS_LOG } from "../lib/config.ts";
import { join } from "path";

const CHART_WIDTH = 60;
const CHART_HEIGHT = 20;

export async function watchCommand() {
  const cwd = process.cwd();

  console.log("ratchet watch — live staircase chart (Ctrl+C to exit)\n");

  let lastCount = 0;

  const render = async () => {
    const entries = await readProgressLog(cwd);
    const watermark = await readWatermark(cwd);

    if (entries.length === lastCount && entries.length > 0) return;
    lastCount = entries.length;

    if (entries.length === 0) {
      console.log("No iterations yet. Waiting...\n");
      return;
    }

    // Clear screen
    process.stdout.write("\x1b[2J\x1b[H");
    console.log("ratchet watch — live staircase chart (Ctrl+C to exit)\n");

    renderStaircase(entries, watermark);
    renderSummary(entries, watermark);
  };

  // Initial render
  await render();

  // Watch for changes to progress.log
  const logPath = join(cwd, PROGRESS_LOG);

  const interval = setInterval(async () => {
    await render();
  }, 2000);

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\n");
    process.exit(0);
  });

  // Keep alive
  await new Promise(() => {});
}

function renderStaircase(entries: ProgressEntry[], currentWatermark: number) {
  // Build watermark staircase: track the watermark value over iterations
  const watermarks: number[] = [];
  let wm = entries[0]?.prevScore ?? 0;
  for (const e of entries) {
    if (e.status === "kept") {
      wm = e.score;
    }
    watermarks.push(wm);
  }

  const allScores = entries.map((e) => e.score);
  const minScore = Math.min(...allScores, ...watermarks);
  const maxScore = Math.max(...allScores, ...watermarks);
  const range = maxScore - minScore || 1;

  // Build the chart grid
  const width = Math.min(CHART_WIDTH, entries.length);
  const height = CHART_HEIGHT;

  // Sample entries if more than chart width
  const step = entries.length > width ? entries.length / width : 1;
  const sampledEntries: ProgressEntry[] = [];
  const sampledWatermarks: number[] = [];
  for (let i = 0; i < width; i++) {
    const idx = Math.min(Math.round(i * step), entries.length - 1);
    sampledEntries.push(entries[idx]!);
    sampledWatermarks.push(watermarks[idx]!);
  }

  // Create grid
  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => " ")
  );

  // Plot watermark staircase
  for (let x = 0; x < width; x++) {
    const y = Math.round(((sampledWatermarks[x]! - minScore) / range) * (height - 1));
    const row = height - 1 - y;
    grid[row]![x] = "█";

    // Fill below watermark for staircase effect
    for (let r = row + 1; r < height; r++) {
      if (grid[r]![x] === " ") grid[r]![x] = "░";
    }
  }

  // Plot individual scores
  for (let x = 0; x < width; x++) {
    const entry = sampledEntries[x]!;
    const y = Math.round(((entry.score - minScore) / range) * (height - 1));
    const row = height - 1 - y;
    if (entry.status === "kept") {
      grid[row]![x] = "●";
    } else {
      grid[row]![x] = "·";
    }
  }

  // Render with Y-axis labels
  const labelWidth = 8;
  for (let r = 0; r < height; r++) {
    const value = maxScore - (r / (height - 1)) * range;
    const label = r === 0 || r === height - 1 || r === Math.floor(height / 2)
      ? value.toFixed(3).padStart(labelWidth)
      : " ".repeat(labelWidth);
    console.log(`${label} │${grid[r]!.join("")}│`);
  }

  // X-axis
  console.log(" ".repeat(labelWidth) + " └" + "─".repeat(width) + "┘");
  const xLabel = `  1${" ".repeat(Math.max(0, width - String(entries.length).length - 1))}${entries.length}`;
  console.log(" ".repeat(labelWidth) + xLabel);

  console.log();
  console.log(`  ● kept  · discarded  █ watermark  ░ floor`);
  console.log();
}

function renderSummary(entries: ProgressEntry[], watermark: number) {
  const kept = entries.filter((e) => e.status === "kept").length;
  const total = entries.length;
  const acceptRate = total > 0 ? ((kept / total) * 100).toFixed(1) : "0.0";

  console.log(`  Iterations: ${total}  |  Kept: ${kept}  |  Accept rate: ${acceptRate}%`);
  console.log(`  Current watermark: ${watermark}`);

  if (entries.length > 0) {
    const last = entries[entries.length - 1]!;
    console.log(`  Last: ${last.status} (${last.score.toFixed(4)}) — ${last.summary}`);
  }
  console.log();
}
