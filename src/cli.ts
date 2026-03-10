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

const program = new Command();

program
  .name("ratchet")
  .description("Agentic optimization loop with high watermarking")
  .version("0.1.0");

program
  .command("init")
  .description("Walk through anchor type selection and setup")
  .action(initCommand);

program
  .command("start")
  .description("Start an optimization run")
  .option("-n, --iterations <n>", "Number of iterations", "20")
  .option("--min-delta <delta>", "Minimum improvement to accept", "0.001")
  .option("--schedule <cron>", "Cron schedule for recurring runs")
  .option("--model <model>", "Claude model to use", "claude-sonnet-4-20250514")
  .action(startCommand);

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
  .description("Lever state at a specific iteration")
  .action(showCommand);

program
  .command("checkout <iteration>")
  .description("Restore lever to a specific iteration's best state")
  .action(checkoutCommand);

program
  .command("pause")
  .description("Pause a running optimization")
  .action(pauseCommand);

program
  .command("resume")
  .description("Resume a paused optimization")
  .action(resumeCommand);

program.parse();
