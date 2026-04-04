#!/usr/bin/env bun
import { Command } from "commander";
import { initCommand } from "./commands/init.ts";
import { startCommand } from "./commands/start.ts";
import { watchCommand } from "./commands/watch.ts";
import { logCommand } from "./commands/log.ts";
import { diffCommand } from "./commands/diff.ts";
import { showCommand } from "./commands/show.ts";
import { checkoutCommand } from "./commands/checkout.ts";
import { pauseCommand, resumeCommand } from "./commands/pause.ts";
import { learningsCommand } from "./commands/learnings.ts";
import { compressCommand } from "./commands/compress.ts";
import { tokensCommand } from "./commands/tokens.ts";

const program = new Command();

program
  .name("ratchet")
  .description("Agentic optimization loop with high watermarking")
  .version("0.1.0");

program
  .command("init")
  .description("Scaffold a RATCHET.md in the current directory")
  .action(initCommand);

program
  .command("start")
  .description("Start an optimization run")
  .option("-n, --iterations <n>", "Number of iterations", "20")
  .option("--min-delta <delta>", "Minimum improvement to accept", "0.001")
  .option("--model <model>", "Proposer model", "claude-haiku-4-5-20251001")
  .option("--judge-model <model>", "Judge model (defaults to --model)")
  .option("--fresh", "Start fresh, ignoring any saved state")
  .option("--max-spend <dollars>", "Maximum USD to spend on API calls before stopping")
  .option("--max-stale <n>", "Stop after N consecutive discarded iterations (default: 5)", "5")
  .action(startCommand);

program
  .command("tokens")
  .description("Visualize how the LLM tokenizes the prompt (or any file)")
  .option("-f, --file <path>", "File to tokenize (default: prompt from RATCHET.md)")
  .option("-m, --mode <mode>", "Visualization mode: color|boundary|ids|heatmap|stats", "color")
  .option("--model <model>", "Model for tokenizer selection", "claude-haiku-4-5-20251001")
  .action(tokensCommand);

program
  .command("compress")
  .description("Optimize token efficiency of the prompt while preserving quality")
  .option("-n, --iterations <n>", "Number of compression iterations", "10")
  .option("--model <model>", "Proposer model", "claude-haiku-4-5-20251001")
  .option("--judge-model <model>", "Judge model (defaults to --model)")
  .option("--quality-bar <score>", "Minimum quality score (default: current watermark)")
  .option("--quality-margin <margin>", "Acceptable quality drop for token savings (default: 0.03)")
  .option("--min-token-reduction <pct>", "Min token reduction % to accept quality drop (default: 0.10)")
  .option("--max-spend <dollars>", "Maximum USD to spend on API calls")
  .option("--max-stale <n>", "Stop after N consecutive discarded iterations (default: 5)", "5")
  .action(compressCommand);

program
  .command("watch")
  .description("Live staircase chart of score progression")
  .action(watchCommand);

program
  .command("log")
  .description("Full iteration history")
  .action(logCommand);

program
  .command("diff <from> <to>")
  .description("What changed between two iterations")
  .action(diffCommand);

program
  .command("show <iteration>")
  .description("Prompt state at a specific iteration")
  .action(showCommand);

program
  .command("checkout <iteration>")
  .description("Restore prompt to a specific iteration's best state")
  .action(checkoutCommand);

program
  .command("learnings")
  .description("Show tactical learnings extracted from runs")
  .action(learningsCommand);

program
  .command("pause")
  .description("Pause a running optimization")
  .action(pauseCommand);

program
  .command("resume")
  .description("Resume a paused optimization")
  .action(resumeCommand);

program.parse();
