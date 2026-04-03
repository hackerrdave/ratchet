import { join } from "path";
import { mkdir } from "fs/promises";
import {
  RATCHET_MD,
  OUTPUT_DIR,
  BEST_DIR,
  PAUSE_FILE,
  parseRatchetMd,
  estimateCost,
} from "../lib/config.ts";
import { runJudge } from "../lib/judge.ts";
import { readWatermark, writeWatermark } from "../lib/watermark.ts";
import { appendProgress, snapshotLever, type ProgressEntry } from "../lib/progress.ts";
import { runAgent } from "../lib/agent.ts";
import { extractLearnings } from "../lib/learnings.ts";
import { readState, writeState, clearState, generateRunId } from "../lib/state.ts";
import { countTokens, getTokenStats } from "../lib/tokens.ts";
import { c, header, status, iterResult, formatCost, timer } from "../lib/format.ts";

interface StartOptions {
  iterations: string;
  minDelta: string;
  model: string;
  judgeModel?: string;
  fresh?: boolean;
  maxSpend?: string;
}

export async function startCommand(options: StartOptions) {
  const cwd = process.cwd();

  if (!(await Bun.file(join(cwd, RATCHET_MD)).exists())) {
    console.error(`No ${RATCHET_MD} found. Create one or run \`ratchet init\`.`);
    process.exit(1);
  }

  if (!process.env["ANTHROPIC_API_KEY"]) {
    console.error("ANTHROPIC_API_KEY environment variable is required.");
    process.exit(1);
  }

  const ratchetMdContent = await Bun.file(join(cwd, RATCHET_MD)).text();
  let config;
  try {
    config = parseRatchetMd(ratchetMdContent);
  } catch (err) {
    console.error(`Invalid ${RATCHET_MD}: ${err}`);
    console.error(`\nRATCHET.md must have # Goal, # Prompt, and # Eval sections.`);
    console.error(`The # Eval section needs at minimum:`);
    console.error(`  - Test cases: <path to JSON file>`);
    console.error(`  - At least one scoring criterion`);
    process.exit(1);
  }

  if (!(await Bun.file(join(cwd, config.eval.testCases)).exists())) {
    console.error(`Test cases file not found: ${config.eval.testCases}`);
    process.exit(1);
  }

  await mkdir(join(cwd, BEST_DIR), { recursive: true });
  await mkdir(join(cwd, OUTPUT_DIR), { recursive: true });

  const iterations = parseInt(options.iterations, 10);
  const minDelta = parseFloat(options.minDelta);
  const model = options.model;
  const judgeModel = options.judgeModel;
  const maxSpend = options.maxSpend ? parseFloat(options.maxSpend) : undefined;

  let startIteration = 1;
  let runId: string;
  let totalSpend = 0;
  const existingState = await readState(cwd);
  if (existingState && !options.fresh) {
    startIteration = existingState.currentIteration;
    runId = existingState.runId;
    totalSpend = existingState.totalSpend || 0;
    console.log(`\n  ${c.cyan}↻${c.reset} Resuming run ${c.bold}${runId}${c.reset} from iteration ${startIteration}/${iterations}`);
  } else {
    runId = generateRunId();
  }

  // Baseline
  let watermark = await readWatermark(cwd);
  if (watermark === -Infinity) {
    const s = status("Running baseline eval");
    try {
      const baseline = await runJudge(cwd, { targetModel: model, judgeModel });
      watermark = baseline.score;
      await writeWatermark(cwd, watermark);
      s.done(`${c.bold}${watermark.toFixed(4)}${c.reset} ${c.dim}(${baseline.cases.length} test cases)${c.reset}`);
    } catch (err) {
      s.fail(`${err}`);
      process.exit(1);
    }
  }

  // Show config
  let tokenInfo = "";
  try {
    const promptContent = await Bun.file(join(cwd, config.prompt)).text();
    const stats = getTokenStats(promptContent, model);
    tokenInfo = `${stats.tokenCount} tokens (${formatCost(stats.estimatedCostPerCall)}/call)`;
  } catch {}

  const items: [string, string][] = [
    ["Prompt", `${config.prompt}${tokenInfo ? `  ${c.dim}${tokenInfo}${c.reset}` : ""}`],
    ["Test cases", config.eval.testCases],
    ["Proposer", model],
    ...(judgeModel ? [["Judge", judgeModel] as [string, string]] : []),
    ["Iterations", `${iterations}`],
    ["Min delta", `${minDelta}`],
    ["Watermark", `${c.bold}${watermark.toFixed(4)}${c.reset}`],
  ];
  if (maxSpend !== undefined) items.push(["Max spend", formatCost(maxSpend)]);
  header(`Ratchet ${c.dim}[${runId}]${c.reset}`, items);

  let kept = 0;
  let discarded = 0;

  for (let i = startIteration; i <= iterations; i++) {
    const iterTimer = timer();

    await writeState(cwd, {
      currentIteration: i,
      totalIterations: iterations,
      model,
      minDelta,
      startedAt: existingState?.startedAt || new Date().toISOString(),
      runId,
      totalSpend,
      maxSpend,
    });

    if (maxSpend !== undefined && totalSpend >= maxSpend) {
      console.log(`\n  ${c.yellow}⚠${c.reset} Budget exhausted (${formatCost(totalSpend)} >= ${formatCost(maxSpend)})`);
      break;
    }

    if (await Bun.file(join(cwd, PAUSE_FILE)).exists()) {
      console.log(`\n  ${c.yellow}⏸${c.reset} Paused at iteration ${i}. Run \`ratchet resume\` to continue.`);
      return;
    }

    const promptPath = join(cwd, config.prompt);
    let originalContent: string;
    try {
      originalContent = await Bun.file(promptPath).text();
    } catch {
      console.error(`\nCannot read prompt file: ${config.prompt}`);
      process.exit(1);
    }

    // Propose
    const proposeStatus = status(`[${i}/${iterations}] Proposing`);
    let agentResult;
    try {
      agentResult = await runAgent(cwd, model);
      proposeStatus.done("");
    } catch (err) {
      proposeStatus.fail(`${err}`);
      const entry: ProgressEntry = {
        iteration: i, runId, model, judgeModel, timestamp: new Date().toISOString(),
        score: watermark, prevScore: watermark, delta: 0,
        status: "discarded", summary: `Proposer error: ${err}`,
      };
      await appendProgress(cwd, entry);
      discarded++;
      continue;
    }

    // Write proposed change
    await Bun.write(promptPath, agentResult.newContent);

    // Judge
    const judgeStatus = status(`[${i}/${iterations}] Judging (${config.eval.testCases})`);
    let judgeResult;
    try {
      judgeResult = await runJudge(cwd, { targetModel: model, judgeModel });
      judgeStatus.done("");
    } catch (err) {
      judgeStatus.fail(`${err}`);
      await Bun.write(promptPath, originalContent);
      const iterCost = estimateCost(model, agentResult.inputTokens, agentResult.outputTokens);
      totalSpend += iterCost;
      const entry: ProgressEntry = {
        iteration: i, runId, model, judgeModel, timestamp: new Date().toISOString(),
        score: watermark, prevScore: watermark, delta: 0,
        status: "discarded", summary: `Judge error: ${err}`,
        inputTokens: agentResult.inputTokens, outputTokens: agentResult.outputTokens,
        cost: iterCost, leverTokens: countTokens(agentResult.newContent, model),
        phase: "quality",
      };
      await appendProgress(cwd, entry);
      discarded++;
      continue;
    }

    const score = judgeResult.score;
    const delta = score - watermark;
    const proposerCost = estimateCost(model, agentResult.inputTokens, agentResult.outputTokens);
    const judgeCost = estimateCost(judgeModel || model, judgeResult.inputTokens, judgeResult.outputTokens);
    const iterCost = proposerCost + judgeCost;
    totalSpend += iterCost;
    const promptTokens = countTokens(agentResult.newContent, model);

    if (delta >= minDelta) {
      watermark = score;
      await writeWatermark(cwd, watermark);
      await snapshotLever(cwd, config.prompt, i);

      const bestFileName = config.prompt.split("/").pop() || "prompt";
      await Bun.write(join(cwd, BEST_DIR, bestFileName), agentResult.newContent);

      const entry: ProgressEntry = {
        iteration: i, runId, model, judgeModel, timestamp: new Date().toISOString(),
        score, prevScore: score - delta, delta, status: "kept",
        summary: agentResult.summary,
        inputTokens: agentResult.inputTokens + judgeResult.inputTokens,
        outputTokens: agentResult.outputTokens + judgeResult.outputTokens,
        cost: iterCost, leverTokens: promptTokens, phase: "quality",
      };
      await appendProgress(cwd, entry);

      iterResult({
        iteration: i, total: iterations, status: "kept",
        score, delta, tokens: promptTokens, cost: iterCost,
        summary: agentResult.summary, elapsed: iterTimer.format(),
      });
      kept++;
    } else {
      await Bun.write(promptPath, originalContent);

      const entry: ProgressEntry = {
        iteration: i, runId, model, judgeModel, timestamp: new Date().toISOString(),
        score, prevScore: watermark, delta, status: "discarded",
        summary: agentResult.summary,
        inputTokens: agentResult.inputTokens + judgeResult.inputTokens,
        outputTokens: agentResult.outputTokens + judgeResult.outputTokens,
        cost: iterCost, leverTokens: promptTokens, phase: "quality",
      };
      await appendProgress(cwd, entry);

      iterResult({
        iteration: i, total: iterations, status: "discarded",
        score, delta, tokens: promptTokens, cost: iterCost,
        summary: agentResult.summary, elapsed: iterTimer.format(),
      });
      discarded++;
    }
  }

  await clearState(cwd);

  // Summary
  header("Done", [
    ["Kept", `${c.green}${kept}${c.reset}`],
    ["Discarded", `${c.yellow}${discarded}${c.reset}`],
    ["Watermark", `${c.bold}${watermark.toFixed(4)}${c.reset}`],
    ["Total spend", formatCost(totalSpend)],
  ]);

  const learnStatus = status("Extracting learnings");
  try {
    await extractLearnings(cwd, model);
    learnStatus.done("");
  } catch (err) {
    learnStatus.fail(`${err}`);
  }
}
