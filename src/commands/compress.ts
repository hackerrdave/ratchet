import { join } from "path";
import { mkdir } from "fs/promises";
import {
  RATCHET_MD,
  OUTPUT_DIR,
  BEST_DIR,
  PAUSE_FILE,
  parseRatchetMd,
  estimateCost,
  EFFICIENCY_DEFAULTS,
} from "../lib/config.ts";
import { runJudge } from "../lib/judge.ts";
import { readWatermark, writeWatermark } from "../lib/watermark.ts";
import { appendProgress, snapshotLever, snapshotOriginal, type ProgressEntry } from "../lib/progress.ts";
import { runCompressAgent } from "../lib/agent.ts";
import { countTokens, getTokenStats } from "../lib/tokens.ts";
import { generateRunId } from "../lib/state.ts";
import { c, header, status, iterResult, formatCost, timer } from "../lib/format.ts";

interface CompressOptions {
  iterations: string;
  model: string;
  judgeModel?: string;
  qualityBar?: string;
  qualityMargin?: string;
  minTokenReduction?: string;
  maxSpend?: string;
  maxStale?: string;
}

export async function compressCommand(options: CompressOptions) {
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
    process.exit(1);
  }

  await mkdir(join(cwd, BEST_DIR), { recursive: true });
  await mkdir(join(cwd, OUTPUT_DIR), { recursive: true });

  const iterations = parseInt(options.iterations, 10);
  const model = options.model;
  const judgeModel = options.judgeModel;
  const maxSpend = options.maxSpend ? parseFloat(options.maxSpend) : undefined;

  const qualityMargin = options.qualityMargin
    ? parseFloat(options.qualityMargin)
    : EFFICIENCY_DEFAULTS.qualityMargin;
  const minTokenReduction = options.minTokenReduction
    ? parseFloat(options.minTokenReduction)
    : EFFICIENCY_DEFAULTS.minTokenReduction;

  const promptPath = join(cwd, config.prompt);

  let watermark = await readWatermark(cwd);
  if (watermark === -Infinity) {
    const s = status("Running baseline eval");
    try {
      const baseline = await runJudge(cwd, { targetModel: model, judgeModel });
      watermark = baseline.score;
      await writeWatermark(cwd, watermark);
      s.done(`${c.bold}${watermark.toFixed(4)}${c.reset}`);
    } catch (err) {
      s.fail(`${err}`);
      process.exit(1);
    }
  }

  const qualityBar = options.qualityBar
    ? parseFloat(options.qualityBar)
    : watermark;

  if (watermark < qualityBar - qualityMargin) {
    console.error(
      `Current quality (${watermark.toFixed(4)}) is below the quality bar (${qualityBar.toFixed(4)}) minus margin (${qualityMargin.toFixed(4)}).`
    );
    console.error(`Run \`ratchet start\` first to bring quality up.`);
    process.exit(1);
  }

  const promptContent = await Bun.file(promptPath).text();
  const initialTokens = countTokens(promptContent, model);
  const initialStats = getTokenStats(promptContent, model);
  const runId = generateRunId();
  const maxStale = parseInt(options.maxStale || "5", 10);

  header(`Compress ${c.dim}[${runId}]${c.reset}`, [
    ["Prompt", `${config.prompt}  ${c.dim}${initialTokens} tokens (${formatCost(initialStats.estimatedCostPerCall)}/call)${c.reset}`],
    ["Model", model],
    ["Iterations", `${iterations}`],
    ["Quality bar", `${c.bold}${qualityBar.toFixed(4)}${c.reset} ${c.dim}(margin: ±${qualityMargin.toFixed(4)}, floor: ${(qualityBar - qualityMargin).toFixed(4)})${c.reset}`],
    ["Min token reduction", `${(minTokenReduction * 100).toFixed(0)}%`],
    ["Watermark", `${c.bold}${watermark.toFixed(4)}${c.reset}`],
    ["Max stale", `${maxStale}`],
  ]);
  // Save the original prompt before any mutations
  await snapshotOriginal(cwd, config.prompt);

  let kept = 0;
  let discarded = 0;
  let totalSpend = 0;
  let consecutiveDiscards = 0;
  let currentTokens = initialTokens;
  let bestScore = watermark;

  for (let i = 1; i <= iterations; i++) {
    const iterTimer = timer();

    if (maxSpend !== undefined && totalSpend >= maxSpend) {
      console.log(`\n  ${c.yellow}⚠${c.reset} Budget exhausted (${formatCost(totalSpend)} >= ${formatCost(maxSpend)})`);
      break;
    }

    if (await Bun.file(join(cwd, PAUSE_FILE)).exists()) {
      console.log(`\n  ${c.yellow}⏸${c.reset} Paused at iteration ${i}. Run \`ratchet resume\` to continue.`);
      return;
    }

    let originalContent: string;
    try {
      originalContent = await Bun.file(promptPath).text();
    } catch {
      console.error(`\nCannot read prompt file: ${config.prompt}`);
      process.exit(1);
    }

    // Propose compression
    const proposeStatus = status(`[${i}/${iterations}] Compressing`);
    let agentResult;
    try {
      agentResult = await runCompressAgent(cwd, model, {
        qualityBar, qualityMargin, currentTokens,
      });
      proposeStatus.done("");
    } catch (err) {
      proposeStatus.fail(`${err}`);
      discarded++;
      consecutiveDiscards++;
      if (consecutiveDiscards >= maxStale) {
        console.log(`\n  ${c.yellow}⚠${c.reset} ${maxStale} consecutive discards — stopping early (likely at peak)`);
        break;
      }
      continue;
    }

    await Bun.write(promptPath, agentResult.newContent);

    // Judge
    const judgeStatus = status(`[${i}/${iterations}] Judging`);
    let judgeResult;
    try {
      judgeResult = await runJudge(cwd, { targetModel: model, judgeModel });
      judgeStatus.done("");
    } catch (err) {
      judgeStatus.fail(`${err}`);
      await Bun.write(promptPath, originalContent);
      const iterCost = estimateCost(model, agentResult.inputTokens, agentResult.outputTokens);
      totalSpend += iterCost;
      discarded++;
      consecutiveDiscards++;
      if (consecutiveDiscards >= maxStale) {
        console.log(`\n  ${c.yellow}⚠${c.reset} ${maxStale} consecutive discards — stopping early (likely at peak)`);
        break;
      }
      continue;
    }

    const score = judgeResult.score;
    const newTokens = countTokens(agentResult.newContent, model);
    const tokenReduction = (currentTokens - newTokens) / currentTokens;
    const qualityDelta = score - bestScore;
    const proposerCost = estimateCost(model, agentResult.inputTokens, agentResult.outputTokens);
    const judgeCost = estimateCost(judgeModel || model, judgeResult.inputTokens, judgeResult.outputTokens);
    const iterCost = proposerCost + judgeCost;
    totalSpend += iterCost;

    const qualityOk = score >= qualityBar - qualityMargin;
    const qualityDropped = score < bestScore;
    const tokensReduced = newTokens < currentTokens;
    const substantialReduction = tokenReduction >= minTokenReduction;

    const accept =
      qualityOk &&
      tokensReduced &&
      (!qualityDropped || substantialReduction);

    if (accept) {
      bestScore = score;
      currentTokens = newTokens;

      if (score > watermark) {
        watermark = score;
        await writeWatermark(cwd, watermark);
      }

      await snapshotLever(cwd, config.prompt, 10000 + i);

      const bestFileName = config.prompt.split("/").pop() || "prompt";
      await Bun.write(join(cwd, BEST_DIR, bestFileName), agentResult.newContent);

      const entry: ProgressEntry = {
        iteration: i, runId, model, judgeModel, timestamp: new Date().toISOString(),
        score, prevScore: bestScore - qualityDelta, delta: qualityDelta,
        status: "kept", summary: agentResult.summary,
        inputTokens: agentResult.inputTokens + judgeResult.inputTokens,
        outputTokens: agentResult.outputTokens + judgeResult.outputTokens,
        cost: iterCost, leverTokens: newTokens,
        phase: "efficiency", tokenReduction,
      };
      await appendProgress(cwd, entry);

      const reductionPct = (tokenReduction * 100).toFixed(1);
      iterResult({
        iteration: i, total: iterations, status: "kept",
        score, delta: qualityDelta, tokens: newTokens, cost: iterCost,
        summary: `${agentResult.summary} ${c.magenta}(-${reductionPct}% tokens)${c.reset}`,
        elapsed: iterTimer.format(),
      });
      kept++;
      consecutiveDiscards = 0;
    } else {
      await Bun.write(promptPath, originalContent);

      const reason = !qualityOk
        ? "quality below floor"
        : !tokensReduced
          ? "no token reduction"
          : "insufficient reduction for quality drop";

      const entry: ProgressEntry = {
        iteration: i, runId, model, judgeModel, timestamp: new Date().toISOString(),
        score, prevScore: bestScore, delta: qualityDelta,
        status: "discarded", summary: agentResult.summary,
        inputTokens: agentResult.inputTokens + judgeResult.inputTokens,
        outputTokens: agentResult.outputTokens + judgeResult.outputTokens,
        cost: iterCost, leverTokens: newTokens,
        phase: "efficiency", tokenReduction,
      };
      await appendProgress(cwd, entry);

      iterResult({
        iteration: i, total: iterations, status: "discarded",
        score, delta: qualityDelta, tokens: newTokens, cost: iterCost,
        summary: `${agentResult.summary} ${c.dim}(${reason})${c.reset}`,
        elapsed: iterTimer.format(),
      });
      discarded++;
      consecutiveDiscards++;
    }

    if (consecutiveDiscards >= maxStale) {
      console.log(`\n  ${c.yellow}⚠${c.reset} ${maxStale} consecutive discards — stopping early (likely at peak)`);
      break;
    }
  }

  // Final summary
  const finalContent = await Bun.file(promptPath).text();
  const finalTokens = countTokens(finalContent, model);
  const finalStats = getTokenStats(finalContent, model);
  const totalReduction = ((initialTokens - finalTokens) / initialTokens) * 100;
  const tokenDelta = totalReduction >= 0 ? `-${totalReduction.toFixed(1)}%` : `+${Math.abs(totalReduction).toFixed(1)}%`;

  header("Compression complete", [
    ["Kept", `${c.green}${kept}${c.reset}`],
    ["Discarded", `${c.yellow}${discarded}${c.reset}`],
    ["Tokens", `${initialTokens} → ${c.bold}${finalTokens}${c.reset} ${c.magenta}(${tokenDelta})${c.reset}`],
    ["Cost/call", `${formatCost(initialStats.estimatedCostPerCall)} → ${c.bold}${formatCost(finalStats.estimatedCostPerCall)}${c.reset}`],
    ["Quality", `${c.bold}${watermark.toFixed(4)}${c.reset} ${c.dim}(bar: ${qualityBar.toFixed(4)})${c.reset}`],
    ["Total spend", formatCost(totalSpend)],
  ]);

  if (totalReduction > 0) {
    const savingsPerCall = initialStats.estimatedCostPerCall - finalStats.estimatedCostPerCall;
    if (savingsPerCall > 0) {
      const breakEven = Math.ceil(totalSpend / savingsPerCall);
      console.log(`  ${c.dim}Break-even: ~${breakEven.toLocaleString()} API calls to recoup compression cost${c.reset}\n`);
    }
  }
}
