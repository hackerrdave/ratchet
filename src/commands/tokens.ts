import { join } from "path";
import { RATCHET_MD, parseRatchetMd } from "../lib/config.ts";
import { countTokens, tokenize, getTokenStats, type DecodedToken } from "../lib/tokens.ts";

interface TokensOptions {
  file?: string;
  mode: "color" | "boundary" | "ids" | "heatmap" | "stats";
  model: string;
}

// ANSI 256-color backgrounds — a rotating palette so adjacent tokens are visually distinct.
const TOKEN_COLORS = [
  "\x1b[48;5;217m\x1b[38;5;0m", // light red bg
  "\x1b[48;5;229m\x1b[38;5;0m", // light yellow bg
  "\x1b[48;5;158m\x1b[38;5;0m", // light green bg
  "\x1b[48;5;153m\x1b[38;5;0m", // light blue bg
  "\x1b[48;5;183m\x1b[38;5;0m", // light purple bg
  "\x1b[48;5;223m\x1b[38;5;0m", // light orange bg
  "\x1b[48;5;195m\x1b[38;5;0m", // light cyan bg
  "\x1b[48;5;225m\x1b[38;5;0m", // light pink bg
];
const RESET = "\x1b[0m";

const HEATMAP_COLD = "\x1b[48;5;236m\x1b[38;5;250m";
const HEATMAP_COOL = "\x1b[48;5;22m\x1b[38;5;255m";
const HEATMAP_WARM = "\x1b[48;5;130m\x1b[38;5;255m";
const HEATMAP_HOT  = "\x1b[48;5;160m\x1b[38;5;255m";

export async function tokensCommand(options: TokensOptions) {
  const cwd = process.cwd();
  const model = options.model;

  let filePath: string;
  if (options.file) {
    filePath = options.file;
  } else {
    const ratchetMd = join(cwd, RATCHET_MD);
    if (!(await Bun.file(ratchetMd).exists())) {
      console.error(`No ${RATCHET_MD} found and no --file specified.`);
      process.exit(1);
    }
    const config = parseRatchetMd(await Bun.file(ratchetMd).text());
    filePath = config.prompt;
  }

  const fullPath = join(cwd, filePath);
  if (!(await Bun.file(fullPath).exists())) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = await Bun.file(fullPath).text();
  const tokens = tokenize(content, model);
  const stats = getTokenStats(content, model);

  switch (options.mode) {
    case "color":
      renderColor(tokens, filePath, stats);
      break;
    case "boundary":
      renderBoundary(tokens, filePath, stats);
      break;
    case "ids":
      renderIds(tokens, filePath, stats);
      break;
    case "heatmap":
      renderHeatmap(tokens, filePath, stats);
      break;
    case "stats":
      renderStats(tokens, filePath, stats, content);
      break;
  }
}

function header(filePath: string, stats: ReturnType<typeof getTokenStats>) {
  console.log(`\n  File: ${filePath}`);
  console.log(`  Tokens: ${stats.tokenCount}`);
  console.log(`  Est. cost/call: $${stats.estimatedCostPerCall.toFixed(6)}`);
  console.log();
}

function renderColor(tokens: DecodedToken[], filePath: string, stats: ReturnType<typeof getTokenStats>) {
  header(filePath, stats);
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const color = TOKEN_COLORS[i % TOKEN_COLORS.length]!;
    const text = tokens[i]!.text;
    if (text.includes("\n")) {
      const parts = text.split("\n");
      for (let j = 0; j < parts.length; j++) {
        if (j > 0) out += RESET + "\n";
        if (parts[j]) out += color + parts[j];
      }
    } else {
      out += color + text;
    }
  }
  out += RESET;
  console.log(out);
  console.log();
}

function renderBoundary(tokens: DecodedToken[], filePath: string, stats: ReturnType<typeof getTokenStats>) {
  header(filePath, stats);
  const DIM = "\x1b[2m";
  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const text = tokens[i]!.text;
    const display = text
      .replace(/ /g, "·")
      .replace(/\n/g, "↵\n")
      .replace(/\t/g, "→   ");
    out += display;
    if (i < tokens.length - 1) {
      out += DIM + "│" + RESET;
    }
  }
  console.log(out);
  console.log();
}

function renderIds(tokens: DecodedToken[], filePath: string, stats: ReturnType<typeof getTokenStats>) {
  header(filePath, stats);
  const DIM = "\x1b[2m";
  const CYAN = "\x1b[36m";

  console.log(`  ${"#".padStart(5)}  ${"ID".padStart(7)}  Token text`);
  console.log(`  ${"─".repeat(5)}  ${"─".repeat(7)}  ${"─".repeat(40)}`);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const display = t.text
      .replace(/ /g, "·")
      .replace(/\n/g, "↵")
      .replace(/\t/g, "→");
    const idx = String(i + 1).padStart(5);
    const id = String(t.id).padStart(7);
    console.log(`  ${DIM}${idx}${RESET}  ${CYAN}${id}${RESET}  ${JSON.stringify(display)}`);
  }
  console.log();
}

function renderHeatmap(tokens: DecodedToken[], filePath: string, stats: ReturnType<typeof getTokenStats>) {
  header(filePath, stats);
  console.log("  Heatmap: token efficiency (chars/token)");
  console.log(`  ${HEATMAP_HOT} 1 char ${RESET} ${HEATMAP_WARM} 2-3 chars ${RESET} ${HEATMAP_COOL} 4-5 chars ${RESET} ${HEATMAP_COLD} 6+ chars ${RESET}`);
  console.log(`  (longer tokens = more efficient = colder)\n`);

  let out = "";
  for (let i = 0; i < tokens.length; i++) {
    const text = tokens[i]!.text;
    const len = text.replace(/\n/g, "").length || 1;
    let color: string;
    if (len >= 6) color = HEATMAP_COLD;
    else if (len >= 4) color = HEATMAP_COOL;
    else if (len >= 2) color = HEATMAP_WARM;
    else color = HEATMAP_HOT;

    if (text.includes("\n")) {
      const parts = text.split("\n");
      for (let j = 0; j < parts.length; j++) {
        if (j > 0) out += RESET + "\n";
        if (parts[j]) out += color + parts[j];
      }
    } else {
      out += color + text;
    }
  }
  out += RESET;
  console.log(out);
  console.log();
}

function renderStats(tokens: DecodedToken[], filePath: string, stats: ReturnType<typeof getTokenStats>, content: string) {
  header(filePath, stats);

  const charCount = content.length;
  const lineCount = content.split("\n").length;
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  console.log("  Overview");
  console.log(`  ────────────────────────────────`);
  console.log(`  Characters:      ${charCount.toLocaleString()}`);
  console.log(`  Words:           ${wordCount.toLocaleString()}`);
  console.log(`  Lines:           ${lineCount.toLocaleString()}`);
  console.log(`  Tokens:          ${stats.tokenCount.toLocaleString()}`);
  console.log(`  Chars/token:     ${(charCount / stats.tokenCount).toFixed(2)}`);
  console.log(`  Words/token:     ${(wordCount / stats.tokenCount).toFixed(2)}`);
  console.log();

  const lenBuckets: Record<string, number> = {
    "1 char": 0,
    "2-3 chars": 0,
    "4-5 chars": 0,
    "6+ chars": 0,
  };
  for (const t of tokens) {
    const len = t.text.length;
    if (len >= 6) lenBuckets["6+ chars"]!++;
    else if (len >= 4) lenBuckets["4-5 chars"]!++;
    else if (len >= 2) lenBuckets["2-3 chars"]!++;
    else lenBuckets["1 char"]!++;
  }

  console.log("  Token length distribution");
  console.log(`  ────────────────────────────────`);
  const maxCount = Math.max(...Object.values(lenBuckets));
  const barWidth = 30;
  for (const [label, count] of Object.entries(lenBuckets)) {
    const pct = ((count / tokens.length) * 100).toFixed(1);
    const bar = "█".repeat(Math.round((count / maxCount) * barWidth));
    console.log(`  ${label.padEnd(12)} ${bar} ${count} (${pct}%)`);
  }
  console.log();

  const freq = new Map<string, number>();
  for (const t of tokens) {
    const key = t.text;
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  console.log("  Most common tokens");
  console.log(`  ────────────────────────────────`);
  for (const [text, count] of sorted) {
    const display = text
      .replace(/ /g, "·")
      .replace(/\n/g, "↵")
      .replace(/\t/g, "→");
    const pct = ((count / tokens.length) * 100).toFixed(1);
    console.log(`  ${String(count).padStart(5)}× (${pct.padStart(5)}%)  ${JSON.stringify(display)}`);
  }
  console.log();

  console.log("  Cost projection");
  console.log(`  ────────────────────────────────`);
  for (const calls of [100, 1_000, 10_000, 100_000]) {
    const cost = stats.estimatedCostPerCall * calls;
    console.log(`  ${calls.toLocaleString().padStart(9)} calls → $${cost.toFixed(4)}`);
  }
  console.log();
}
