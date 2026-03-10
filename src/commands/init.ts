import * as p from "@clack/prompts";
import { parse } from "csv-parse/sync";
import { mkdir } from "fs/promises";
import { join } from "path";
import {
  RATCHET_DIR,
  RATCHET_MD,
  SCORER_SH,
  WATERMARK_FILE,
  PROGRESS_LOG,
  LABELED_SET,
  BEST_DIR,
  SNAPSHOTS_DIR,
} from "../lib/config.ts";

export async function initCommand() {
  const cwd = process.cwd();

  p.intro("ratchet init");

  // Check if already initialized
  const ratchetMdExists = await Bun.file(join(cwd, RATCHET_MD)).exists();
  if (ratchetMdExists) {
    const overwrite = await p.confirm({
      message: "RATCHET.md already exists. Reinitialize?",
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.outro("Cancelled.");
      return;
    }
  }

  // Anchor type selection
  const anchorType = await p.select({
    message: "What kind of scorer do you have?",
    options: [
      { value: "objective", label: "Objective", hint: "test suite, build, latency, cost" },
      { value: "labeled", label: "Labeled", hint: "I'll rate examples, you handle the rest" },
      { value: "live", label: "Live signal", hint: "I have a metrics endpoint or DB query" },
      { value: "llm-judge", label: "LLM judge", hint: "use a model to evaluate outputs" },
    ],
  });
  if (p.isCancel(anchorType)) return;

  // Goal
  const goal = await p.text({
    message: "What are you trying to improve? (one sentence)",
    placeholder: "e.g., Improve prompt accuracy for product-recall matching",
    validate: (v) => (!v || v.length < 3 ? "Too short" : undefined),
  });
  if (p.isCancel(goal)) return;

  // Lever
  const lever = await p.text({
    message: "What file is the lever? (path relative to repo root)",
    placeholder: "e.g., prompts/classifier.md",
    validate: (v) => (!v || v.length < 1 ? "Required" : undefined),
  });
  if (p.isCancel(lever)) return;

  // Create ratchet directory structure
  await mkdir(join(cwd, BEST_DIR), { recursive: true });
  await mkdir(join(cwd, SNAPSHOTS_DIR), { recursive: true });

  let scorerContent = "";
  let baselineScore: number | null = null;

  if (anchorType === "objective") {
    await handleObjective(cwd);
    scorerContent = await getObjectiveScorer(cwd);
  } else if (anchorType === "labeled") {
    const result = await handleLabeled(cwd, lever as string);
    scorerContent = result.scorerContent;
    baselineScore = result.baselineScore;
  } else if (anchorType === "live") {
    scorerContent = await handleLiveSignal(cwd);
  } else if (anchorType === "llm-judge") {
    scorerContent = await handleLlmJudge(cwd, lever as string, goal as string);
  }

  // Write RATCHET.md
  const constraintsInput = await p.text({
    message: "Any constraints? (comma-separated, or leave empty)",
    placeholder: "e.g., Must remain under 2000 tokens, Must not remove the routing section",
    initialValue: "",
  });
  if (p.isCancel(constraintsInput)) return;

  const constraints = (constraintsInput as string)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const contextInput = await p.text({
    message: "Any context files the agent should read? (comma-separated paths, or leave empty)",
    placeholder: "e.g., TOPOLOGY.md, docs/architecture.md",
    initialValue: "",
  });
  if (p.isCancel(contextInput)) return;

  const contextFiles = (contextInput as string)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const ratchetMd = generateRatchetMd(goal as string, lever as string, constraints, contextFiles);
  await Bun.write(join(cwd, RATCHET_MD), ratchetMd);

  // Write scorer.sh
  if (scorerContent) {
    await Bun.write(join(cwd, SCORER_SH), scorerContent);
    // Make executable
    const { $ } = await import("bun");
    await $`chmod +x ${join(cwd, SCORER_SH)}`.quiet();
  }

  // Initialize watermark
  if (baselineScore !== null) {
    await Bun.write(join(cwd, WATERMARK_FILE), baselineScore.toString());
  }

  // Initialize empty progress log
  const logPath = join(cwd, PROGRESS_LOG);
  if (!(await Bun.file(logPath).exists())) {
    await Bun.write(logPath, "");
  }

  // Snapshot initial lever state
  try {
    const leverContent = await Bun.file(join(cwd, lever as string)).text();
    const bestFileName = (lever as string).split("/").pop() || "lever";
    await Bun.write(join(cwd, BEST_DIR, bestFileName), leverContent);
  } catch {
    p.log.warn(`Could not snapshot lever at ${lever}. Make sure the file exists before running.`);
  }

  p.outro(
    baselineScore !== null
      ? `Ready. Baseline score: ${baselineScore}. Run \`ratchet start\` to begin.`
      : "Ready. Run `ratchet start` to begin."
  );
}

async function handleObjective(cwd: string) {
  const scorerPath = await p.text({
    message:
      "Do you already have a scorer script? (path to shell script, or leave empty to create one)",
    initialValue: "",
  });
  if (p.isCancel(scorerPath)) return;

  if ((scorerPath as string).trim()) {
    const exists = await Bun.file(join(cwd, scorerPath as string)).exists();
    if (!exists) {
      p.log.error(`File not found: ${scorerPath}`);
      process.exit(1);
    }
    // Copy to scorer.sh
    const content = await Bun.file(join(cwd, scorerPath as string)).text();
    await Bun.write(join(cwd, SCORER_SH), content);
    p.log.success(`Copied scorer from ${scorerPath}`);
  }
}

async function getObjectiveScorer(cwd: string): Promise<string> {
  const exists = await Bun.file(join(cwd, SCORER_SH)).exists();
  if (exists) return await Bun.file(join(cwd, SCORER_SH)).text();

  // Generate a template
  return `#!/bin/bash
# Ratchet scorer — objective type
# Replace this with your actual scoring command.
# Must output a single float to stdout. Higher is better.

# Example: run tests and report pass rate
# TOTAL=$(bun test 2>&1 | grep -oP '\\d+ pass' | grep -oP '\\d+')
# FAILED=$(bun test 2>&1 | grep -oP '\\d+ fail' | grep -oP '\\d+')
# echo "scale=4; $TOTAL / ($TOTAL + $FAILED)" | bc

echo "0.0"
`;
}

async function handleLabeled(
  cwd: string,
  lever: string
): Promise<{ scorerContent: string; baselineScore: number }> {
  // Get input labels
  const inputALabel = await p.text({
    message: "What are you comparing? Input A label:",
    placeholder: "e.g., product description",
  });
  if (p.isCancel(inputALabel)) process.exit(0);

  const inputBLabel = await p.text({
    message: `Input B label:`,
    placeholder: "e.g., recall alert",
  });
  if (p.isCancel(inputBLabel)) process.exit(0);

  // Load examples
  const examplesPath = await p.text({
    message: "Where are your raw examples? (CSV, JSON, or directory)",
    placeholder: "e.g., data/products_and_recalls.csv",
    validate: (v) => (!v || v.length < 1 ? "Required" : undefined),
  });
  if (p.isCancel(examplesPath)) process.exit(0);

  const fullPath = join(cwd, examplesPath as string);
  const file = Bun.file(fullPath);
  if (!(await file.exists())) {
    p.log.error(`File not found: ${examplesPath}`);
    process.exit(1);
  }

  const content = await file.text();
  let examples: Array<{ a: string; b: string }> = [];

  if ((examplesPath as string).endsWith(".csv")) {
    const records = parse(content, { columns: true, skip_empty_lines: true }) as Record<
      string,
      string
    >[];
    const cols = Object.keys(records[0] || {});
    if (cols.length < 2) {
      p.log.error("CSV must have at least 2 columns");
      process.exit(1);
    }
    examples = records.map((r) => ({
      a: r[cols[0]!] || "",
      b: r[cols[1]!] || "",
    }));
  } else if ((examplesPath as string).endsWith(".json")) {
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      examples = data.map((item: Record<string, string>) => {
        const keys = Object.keys(item);
        return { a: item[keys[0]!] || "", b: item[keys[1]!] || "" };
      });
    }
  } else {
    p.log.error("Unsupported format. Use CSV or JSON.");
    process.exit(1);
  }

  p.log.info(`Loaded ${examples.length} candidate pairs.`);

  if (examples.length < 40) {
    p.log.warn(
      `Only ${examples.length} examples — fewer than 40 may produce noisy scores.`
    );
  }

  const labelCount = Math.min(Math.max(50, Math.ceil(examples.length * 0.06)), examples.length);
  const confirmLabel = await p.confirm({
    message: `You need to label at least 40 for reliable signal. Label ${labelCount}?`,
    initialValue: true,
  });
  if (p.isCancel(confirmLabel) || !confirmLabel) {
    p.outro("Cancelled.");
    process.exit(0);
  }

  // Shuffle and pick examples to label
  const shuffled = [...examples].sort(() => Math.random() - 0.5);
  const toLabel = shuffled.slice(0, labelCount);

  const labeledSet: Array<{ a: string; b: string; label: boolean }> = [];
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < toLabel.length; i++) {
    const example = toLabel[i]!;
    const truncA = example.a.length > 200 ? example.a.slice(0, 200) + "..." : example.a;
    const truncB = example.b.length > 200 ? example.b.slice(0, 200) + "..." : example.b;

    p.log.info(`--- Example ${i + 1} of ${toLabel.length} ---`);
    p.log.message(`  ${inputALabel}: ${truncA}`);
    p.log.message(`  ${inputBLabel}: ${truncB}`);

    const answer = await p.select({
      message: "Match?",
      options: [
        { value: "y", label: "Yes" },
        { value: "n", label: "No" },
        { value: "skip", label: "Skip" },
      ],
    });

    if (p.isCancel(answer)) {
      p.log.warn("Labeling cancelled. Saving what we have.");
      break;
    }

    if (answer === "skip") {
      skipped++;
      continue;
    }

    labeledSet.push({
      a: example.a,
      b: example.b,
      label: answer === "y",
    });
  }

  const elapsed = Math.round((Date.now() - startTime) / 60000);
  p.log.success(`Labeled ${labeledSet.length} examples in ${elapsed} minutes.`);

  // Save labeled set
  await Bun.write(join(cwd, LABELED_SET), JSON.stringify(labeledSet, null, 2));
  p.log.success(`Saved to ${LABELED_SET}`);

  // Generate scorer.sh
  const scorerContent = generateLabeledScorer(lever, LABELED_SET);
  p.log.info("Generating scorer.sh from labeled set... done.");

  // Run baseline
  await Bun.write(join(cwd, SCORER_SH), scorerContent);
  const { $ } = await import("bun");
  await $`chmod +x ${join(cwd, SCORER_SH)}`.quiet();

  let baselineScore = 0;
  try {
    const { runScorer } = await import("../lib/scorer.ts");
    baselineScore = await runScorer(join(cwd, SCORER_SH), cwd);
  } catch {
    p.log.warn("Could not run baseline scorer. Score set to 0.");
  }

  const correct = Math.round(baselineScore * labeledSet.length);
  p.log.info(
    `Baseline score: ${baselineScore.toFixed(2)} (${correct}/${labeledSet.length} correct with current state)`
  );

  return { scorerContent, baselineScore };
}

async function handleLiveSignal(cwd: string): Promise<string> {
  p.log.warn(
    "Live signal anchor: be aware of feedback latency. Consider --schedule nightly for better results."
  );

  const endpoint = await p.text({
    message: "Metrics endpoint or command to fetch the score:",
    placeholder: "e.g., curl -s https://api.example.com/metrics | jq .accuracy",
  });
  if (p.isCancel(endpoint)) process.exit(0);

  return `#!/bin/bash
# Ratchet scorer — live signal type
# Fetches score from a live endpoint/command.

${endpoint}
`;
}

async function handleLlmJudge(cwd: string, lever: string, goal: string): Promise<string> {
  p.log.warn(
    "LLM judge is the weakest anchor type. Scores may drift. Consider upgrading to labeled or objective anchors."
  );

  const judgeModel = await p.text({
    message: "Which model should judge? (model ID)",
    initialValue: "claude-haiku-4-20250414",
  });
  if (p.isCancel(judgeModel)) process.exit(0);

  const criteria = await p.text({
    message: "What should the judge evaluate? (scoring criteria)",
    placeholder: "e.g., clarity, accuracy, and completeness on a 0-1 scale",
  });
  if (p.isCancel(criteria)) process.exit(0);

  return `#!/bin/bash
# Ratchet scorer — LLM judge type
# WARNING: This is the weakest anchor type. Scores may not be stable.
# Consider upgrading to a labeled or objective anchor.

LEVER_CONTENT=$(cat "${lever}")

# Call the judge model
SCORE=$(curl -s https://api.anthropic.com/v1/messages \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${judgeModel}",
    "max_tokens": 100,
    "messages": [{"role": "user", "content": "Evaluate the following content on: ${criteria}\\n\\nContent:\\n'"$LEVER_CONTENT"'\\n\\nRespond with ONLY a single float between 0.0 and 1.0."}]
  }' | grep -oP '"text":\\s*"\\K[0-9.]+')

echo "\${SCORE:-0.0}"
`;
}

function generateLabeledScorer(leverPath: string, labeledSetPath: string): string {
  return `#!/bin/bash
# Ratchet scorer — labeled type
# Runs the lever against the labeled set and reports accuracy.
# This is a template — customize the evaluation logic for your use case.

LABELED_SET="${labeledSetPath}"
LEVER="${leverPath}"

if [ ! -f "$LABELED_SET" ]; then
  echo "0.0"
  exit 0
fi

# Count correct matches using the lever
# TODO: Replace this template with your actual evaluation logic.
# This template assumes the lever is a prompt and checks string similarity.
TOTAL=$(cat "$LABELED_SET" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(len(data))
" 2>/dev/null || echo "0")

if [ "$TOTAL" = "0" ]; then
  echo "0.0"
  exit 0
fi

# Placeholder: return ratio of positive labels as baseline
CORRECT=$(cat "$LABELED_SET" | python3 -c "
import json, sys
data = json.load(sys.stdin)
correct = sum(1 for d in data if d.get('label', False))
print(correct)
" 2>/dev/null || echo "0")

echo "scale=4; $CORRECT / $TOTAL" | bc
`;
}

function generateRatchetMd(
  goal: string,
  lever: string,
  constraints: string[],
  contextFiles: string[]
): string {
  const constraintsSection =
    constraints.length > 0
      ? constraints.map((c) => `- ${c}`).join("\n")
      : "- (none specified)";

  const contextSection =
    contextFiles.length > 0
      ? contextFiles.map((f) => `- Read ${f}`).join("\n")
      : "- Read ratchet/progress.log to see what's been tried";

  return `# Goal
${goal}

# Lever
The file at ${lever} is the only thing you may change.
One targeted improvement per iteration. Do not rewrite wholesale.

# Constraints
${constraintsSection}

# Context
${contextSection}
- The scorer measures how well the lever achieves the goal above
`;
}
