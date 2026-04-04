import { readProgressLog, type ProgressEntry } from "../lib/progress.ts";
import { c, header, formatCost } from "../lib/format.ts";

export async function logCommand() {
  const cwd = process.cwd();
  const entries = await readProgressLog(cwd);

  if (entries.length === 0) {
    console.log("No iterations yet. Run `ratchet start` first.");
    return;
  }

  const kept = entries.filter((e) => e.status === "kept");
  const discarded = entries.filter((e) => e.status !== "kept");
  const totalCost = entries.reduce((sum, e) => sum + (e.cost || 0), 0);
  const models = [...new Set(entries.map((e) => e.model).filter(Boolean))];
  const hasTokens = entries.some((e) => e.promptTokens !== undefined);
  const hasPhase = entries.some((e) => e.phase !== undefined);

  // Summary header
  const items: [string, string][] = [
    ["Iterations", `${entries.length} ${c.dim}(${c.reset}${c.green}${kept.length} kept${c.reset}${c.dim}, ${c.reset}${c.yellow}${discarded.length} discarded${c.reset}${c.dim})${c.reset}`],
  ];
  if (totalCost > 0) items.push(["Total cost", formatCost(totalCost)]);
  if (models.length > 0) items.push(["Model" + (models.length > 1 ? "s" : ""), models.join(", ")]);

  // Score range
  const scores = entries.map((e) => e.score);
  const bestScore = Math.max(...scores);
  const firstScore = entries[0]!.prevScore;
  items.push(["Score", `${firstScore.toFixed(4)} → ${c.bold}${bestScore.toFixed(4)}${c.reset}`]);

  header("Ratchet log", items);

  // Iteration table
  for (const e of entries) {
    const iterNum = `${c.dim}${String(e.iteration).padStart(3)}${c.reset}`;

    const statusIcon = e.status === "kept"
      ? `${c.green}✓${c.reset}`
      : `${c.yellow}✗${c.reset}`;

    const scoreStr = `${c.bold}${e.score.toFixed(4)}${c.reset}`;

    const deltaStr = e.delta >= 0 ? `+${e.delta.toFixed(4)}` : e.delta.toFixed(4);
    const deltaColor = e.delta > 0 ? c.green : e.delta < 0 ? c.red : c.dim;

    const costStr = e.cost !== undefined ? formatCost(e.cost) : "—";

    // Build the main line
    let meta = `${scoreStr} ${deltaColor}${deltaStr}${c.reset}`;
    if (hasTokens && e.promptTokens !== undefined) {
      meta += ` ${c.dim}│${c.reset} ${c.cyan}${e.promptTokens}${c.reset}${c.dim}tok${c.reset}`;
    }
    meta += ` ${c.dim}│${c.reset} ${c.dim}${costStr}${c.reset}`;
    if (hasPhase && e.phase) {
      const phaseColor = e.phase === "efficiency" ? c.magenta : c.blue;
      meta += ` ${c.dim}│${c.reset} ${phaseColor}${e.phase}${c.reset}`;
    }

    console.log(`  ${iterNum} ${statusIcon} ${meta}`);
    console.log(`      ${c.dim}${e.summary}${c.reset}`);
  }

  // Token trajectory
  if (hasTokens) {
    printTokenTrajectory(entries);
  }
}

function printTokenTrajectory(entries: ProgressEntry[]) {
  const keptWithTokens = entries.filter(
    (e) => e.status === "kept" && e.promptTokens !== undefined
  );
  if (keptWithTokens.length < 2) return;

  const first = keptWithTokens[0]!;
  const last = keptWithTokens[keptWithTokens.length - 1]!;
  const firstTokens = first.promptTokens!;
  const lastTokens = last.promptTokens!;
  const delta = lastTokens - firstTokens;
  const pct = ((delta / firstTokens) * 100).toFixed(1);

  const tokenValues = keptWithTokens.map((e) => e.promptTokens!);
  const min = Math.min(...tokenValues);
  const max = Math.max(...tokenValues);
  const range = max - min || 1;
  const bars = "▁▂▃▄▅▆▇█";
  const sparkline = tokenValues
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (bars.length - 1));
      return bars[idx];
    })
    .join("");

  const deltaColor = delta <= 0 ? c.green : c.yellow;
  const items: [string, string][] = [
    ["Tokens", `${firstTokens} → ${c.bold}${lastTokens}${c.reset} ${deltaColor}(${delta >= 0 ? "+" : ""}${delta}, ${delta >= 0 ? "+" : ""}${pct}%)${c.reset}`],
    ["", `${c.cyan}${sparkline}${c.reset}`],
  ];

  const phaseRanges = computePhaseRanges(keptWithTokens);

  if (phaseRanges) {
    items.push([
      `${c.blue}Quality${c.reset}`,
      `${phaseRanges.quality.start} → ${phaseRanges.quality.end} tokens ${c.dim}(${phaseRanges.quality.count} kept)${c.reset}`,
    ]);
    items.push([
      `${c.magenta}Efficiency${c.reset}`,
      `${phaseRanges.efficiency.start} → ${phaseRanges.efficiency.end} tokens ${c.dim}(${phaseRanges.efficiency.count} kept)${c.reset}`,
    ]);
  }

  header("Token trajectory", items);
}

export interface PhaseRange {
  start: number;
  end: number;
  count: number;
}

/**
 * Compute token ranges for quality and efficiency phases.
 * Efficiency start equals quality end (where the phase handed off).
 * Returns null if both phases aren't present.
 */
export function computePhaseRanges(
  keptWithTokens: ProgressEntry[]
): { quality: PhaseRange; efficiency: PhaseRange } | null {
  const qualityKept = keptWithTokens.filter((e) => (e.phase || "quality") === "quality");
  const efficiencyKept = keptWithTokens.filter((e) => e.phase === "efficiency");

  if (qualityKept.length === 0 || efficiencyKept.length === 0) return null;

  const qualityStart = qualityKept[0]!.promptTokens!;
  const qualityEnd = qualityKept[qualityKept.length - 1]!.promptTokens!;
  const efficiencyEnd = efficiencyKept[efficiencyKept.length - 1]!.promptTokens!;

  return {
    quality: { start: qualityStart, end: qualityEnd, count: qualityKept.length },
    efficiency: { start: qualityEnd, end: efficiencyEnd, count: efficiencyKept.length },
  };
}
