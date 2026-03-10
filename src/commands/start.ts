import * as p from "@clack/prompts";
import { join } from "path";
import { cp, mkdir } from "fs/promises";
import {
  DEFAULT_NAME,
  ratchetMdPath,
  scorerShPath,
  bestDir,
  pauseFilePath,
  parseRatchetMd,
} from "../lib/config.ts";
import { runScorer } from "../lib/scorer.ts";
import { readWatermark, writeWatermark } from "../lib/watermark.ts";
import { appendProgress, snapshotLever, type ProgressEntry } from "../lib/progress.ts";
import { runAgent } from "../lib/agent.ts";

interface StartOptions {
  iterations: string;
  minDelta: string;
  schedule?: string;
  model: string;
  name: string;
}

export async function startCommand(options: StartOptions) {
  const cwd = process.cwd();
  const name = options.name;

  // Validate prerequisites
  const ratchetMd = join(cwd, ratchetMdPath(name));
  if (!(await Bun.file(ratchetMd).exists())) {
    console.error(`No ${ratchetMdPath(name)} found. Run \`ratchet init --name ${name}\` first.`);
    process.exit(1);
  }

  const scorer = join(cwd, scorerShPath(name));
  if (!(await Bun.file(scorer).exists())) {
    console.error(`No ${scorerShPath(name)} found. Run \`ratchet init --name ${name}\` first.`);
    process.exit(1);
  }

  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.error("ANTHROPIC_API_KEY environment variable is required.");
    process.exit(1);
  }

  const iterations = parseInt(options.iterations, 10);
  const minDelta = parseFloat(options.minDelta);
  const model = options.model;

  if (options.schedule) {
    console.log(`Schedule mode not yet implemented. Run without --schedule for now.`);
    // TODO: implement cron scheduling
    return;
  }

  const ratchetMdContent = await Bun.file(ratchetMd).text();
  const config = parseRatchetMd(ratchetMdContent);

  // Get or set initial watermark
  let watermark = await readWatermark(cwd, name);
  if (watermark === -Infinity) {
    p.intro("No watermark found. Running baseline scorer...");
    try {
      watermark = await runScorer(scorer, cwd);
      await writeWatermark(cwd, watermark, name);
      console.log(`Baseline score: ${watermark}`);
    } catch (err) {
      console.error(`Baseline scorer failed: ${err}`);
      process.exit(1);
    }
  }

  const nameLabel = name !== DEFAULT_NAME ? ` (${name})` : "";
  console.log(`\nStarting ratchet loop${nameLabel}`);
  console.log(`  Lever: ${config.lever}`);
  console.log(`  Model: ${model}`);
  console.log(`  Iterations: ${iterations}`);
  console.log(`  Min delta: ${minDelta}`);
  console.log(`  Current watermark: ${watermark}`);
  console.log();

  let kept = 0;
  let discarded = 0;

  for (let i = 1; i <= iterations; i++) {
    // Check for pause
    if (await Bun.file(join(cwd, pauseFilePath(name))).exists()) {
      console.log(`\nPaused at iteration ${i}. Run \`ratchet resume --name ${name}\` to continue.`);
      return;
    }

    const iterLabel = `[${i}/${iterations}]`;
    process.stdout.write(`${iterLabel} Running agent... `);

    // Save current lever state (for rollback)
    const leverPath = join(cwd, config.lever);
    let originalContent: string;
    try {
      originalContent = await Bun.file(leverPath).text();
    } catch {
      console.error(`\nCannot read lever file: ${config.lever}`);
      process.exit(1);
    }

    let agentResult;
    try {
      agentResult = await runAgent(cwd, model, name);
    } catch (err) {
      console.log(`agent error: ${err}`);
      const entry: ProgressEntry = {
        iteration: i,
        timestamp: new Date().toISOString(),
        score: watermark,
        prevScore: watermark,
        delta: 0,
        status: "discarded",
        summary: `Agent error: ${err}`,
      };
      await appendProgress(cwd, entry, name);
      discarded++;
      continue;
    }

    // Write proposed change
    await Bun.write(leverPath, agentResult.newContent);
    process.stdout.write("scoring... ");

    // Score
    let score: number;
    try {
      score = await runScorer(scorer, cwd);
    } catch (err) {
      console.log(`scorer error: ${err}`);
      // Rollback
      await Bun.write(leverPath, originalContent);
      const entry: ProgressEntry = {
        iteration: i,
        timestamp: new Date().toISOString(),
        score: watermark,
        prevScore: watermark,
        delta: 0,
        status: "discarded",
        summary: `Scorer error: ${err}`,
      };
      await appendProgress(cwd, entry, name);
      discarded++;
      continue;
    }

    const delta = score - watermark;

    if (delta >= minDelta) {
      // Accept
      watermark = score;
      await writeWatermark(cwd, watermark, name);

      // Snapshot
      await snapshotLever(cwd, config.lever, i, name);

      // Update best
      const bestFileName = config.lever.split("/").pop() || "lever";
      await Bun.write(join(cwd, bestDir(name), bestFileName), agentResult.newContent);

      const entry: ProgressEntry = {
        iteration: i,
        timestamp: new Date().toISOString(),
        score,
        prevScore: score - delta,
        delta,
        status: "kept",
        summary: agentResult.summary,
      };
      await appendProgress(cwd, entry, name);

      console.log(`✓ kept  score=${score.toFixed(4)} (+${delta.toFixed(4)}) — ${agentResult.summary}`);
      kept++;
    } else {
      // Reject — rollback
      await Bun.write(leverPath, originalContent);

      const entry: ProgressEntry = {
        iteration: i,
        timestamp: new Date().toISOString(),
        score,
        prevScore: watermark,
        delta,
        status: "discarded",
        summary: agentResult.summary,
      };
      await appendProgress(cwd, entry, name);

      console.log(`✗ disc  score=${score.toFixed(4)} (${delta >= 0 ? "+" : ""}${delta.toFixed(4)}) — ${agentResult.summary}`);
      discarded++;
    }
  }

  console.log(`\nDone. ${kept} kept, ${discarded} discarded. Final watermark: ${watermark}`);
}
