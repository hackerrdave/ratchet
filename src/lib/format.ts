/** ANSI color helpers. Respects NO_COLOR env var and dumb terminals. */

const enabled =
  !process.env["NO_COLOR"] &&
  process.env["TERM"] !== "dumb" &&
  process.stdout.isTTY !== false;

const code = (n: string) => (enabled ? `\x1b[${n}m` : "");

export const c = {
  reset: code("0"),
  bold: code("1"),
  dim: code("2"),
  italic: code("3"),

  // Foreground
  red: code("31"),
  green: code("32"),
  yellow: code("33"),
  blue: code("34"),
  magenta: code("35"),
  cyan: code("36"),
  white: code("37"),
  gray: code("90"),

  // Bright foreground
  brightGreen: code("92"),
  brightYellow: code("93"),
  brightCyan: code("96"),
};

/** Format a duration in ms to a human-readable string */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m${rem}s`;
}

/** Format a cost in USD */
export function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** A simple elapsed timer */
export function timer() {
  const start = performance.now();
  return {
    elapsed: () => performance.now() - start,
    format: () => formatDuration(performance.now() - start),
  };
}

/** Spinner-like progress indicator for long operations */
export function status(label: string) {
  const t = timer();
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  let interval: ReturnType<typeof setInterval> | null = null;

  if (enabled) {
    interval = setInterval(() => {
      process.stdout.write(`\r  ${c.cyan}${frames[i++ % frames.length]}${c.reset} ${c.dim}${label}${c.reset} ${c.dim}(${t.format()})${c.reset}`);
    }, 80);
  } else {
    process.stdout.write(`  ${label}... `);
  }

  return {
    update(newLabel: string) {
      label = newLabel;
    },
    done(result: string) {
      if (interval) clearInterval(interval);
      if (enabled) {
        process.stdout.write(`\r  ${c.green}✓${c.reset} ${label} ${c.dim}(${t.format()})${c.reset} ${result}\n`);
      } else {
        process.stdout.write(`done (${t.format()}) ${result}\n`);
      }
    },
    fail(result: string) {
      if (interval) clearInterval(interval);
      if (enabled) {
        process.stdout.write(`\r  ${c.red}✗${c.reset} ${label} ${c.dim}(${t.format()})${c.reset} ${result}\n`);
      } else {
        process.stdout.write(`failed (${t.format()}) ${result}\n`);
      }
    },
  };
}

/** Print a header box */
export function header(title: string, items: [string, string][]) {
  console.log();
  console.log(`  ${c.bold}${title}${c.reset}`);
  console.log(`  ${c.dim}${"─".repeat(50)}${c.reset}`);
  for (const [key, value] of items) {
    console.log(`  ${c.dim}${key.padEnd(20)}${c.reset} ${value}`);
  }
  console.log();
}

/** Format an iteration result line */
export function iterResult(opts: {
  iteration: number;
  total: number;
  status: "kept" | "discarded" | "error";
  score: number;
  delta: number;
  tokens?: number;
  cost: number;
  summary: string;
  elapsed: string;
}) {
  const { iteration, total, status: s, score, delta, tokens, cost, summary, elapsed } = opts;
  const iterLabel = `${c.dim}[${iteration}/${total}]${c.reset}`;

  const statusIcon =
    s === "kept" ? `${c.green}✓ kept${c.reset}` :
    s === "error" ? `${c.red}✗ error${c.reset}` :
    `${c.yellow}✗ disc${c.reset}`;

  const deltaStr = delta >= 0 ? `+${delta.toFixed(4)}` : delta.toFixed(4);
  const deltaColor = delta > 0 ? c.green : delta < 0 ? c.red : c.dim;

  const scorePart = `${c.bold}${score.toFixed(4)}${c.reset} ${deltaColor}(${deltaStr})${c.reset}`;
  const tokensPart = tokens !== undefined ? ` ${c.dim}│${c.reset} ${c.cyan}${tokens}${c.reset}${c.dim}tok${c.reset}` : "";
  const costPart = `${c.dim}│${c.reset} ${c.dim}${formatCost(cost)}${c.reset}`;
  const timePart = `${c.dim}│${c.reset} ${c.dim}${elapsed}${c.reset}`;

  console.log(`  ${iterLabel} ${statusIcon}  ${scorePart}${tokensPart} ${costPart} ${timePart}`);
  console.log(`  ${" ".repeat(String(total).length * 2 + 3)}${c.dim}${summary}${c.reset}`);
}
