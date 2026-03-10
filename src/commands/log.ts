import { readProgressLog } from "../lib/progress.ts";

export async function logCommand() {
  const cwd = process.cwd();
  const entries = await readProgressLog(cwd);

  if (entries.length === 0) {
    console.log("No iterations yet.");
    return;
  }

  console.log(`${"#".padStart(4)}  ${"Status".padEnd(10)}  ${"Score".padStart(8)}  ${"Delta".padStart(8)}  ${"Timestamp".padEnd(24)}  Summary`);
  console.log("─".repeat(100));

  for (const e of entries) {
    const status = e.status === "kept" ? "✓ kept" : "✗ disc";
    const deltaStr = e.delta >= 0 ? `+${e.delta.toFixed(4)}` : e.delta.toFixed(4);
    console.log(
      `${String(e.iteration).padStart(4)}  ${status.padEnd(10)}  ${e.score.toFixed(4).padStart(8)}  ${deltaStr.padStart(8)}  ${e.timestamp.padEnd(24)}  ${e.summary}`
    );
  }

  const kept = entries.filter((e) => e.status === "kept").length;
  console.log(`\n${entries.length} iterations, ${kept} kept, ${entries.length - kept} discarded`);
}
