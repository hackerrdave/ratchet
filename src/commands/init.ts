import * as p from "@clack/prompts";
import { mkdir } from "fs/promises";
import { join } from "path";
import { RATCHET_MD, OUTPUT_DIR, BEST_DIR, SNAPSHOTS_DIR, PROGRESS_LOG } from "../lib/config.ts";

export async function initCommand() {
  const cwd = process.cwd();

  p.intro("ratchet init");

  // Check if already initialized
  if (await Bun.file(join(cwd, RATCHET_MD)).exists()) {
    const overwrite = await p.confirm({
      message: `${RATCHET_MD} already exists. Reinitialize?`,
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite) {
      p.outro("Cancelled.");
      return;
    }
  }

  // Goal
  const goal = await p.text({
    message: "What are you trying to improve? (one sentence)",
    placeholder: "e.g., Improve sentiment classification accuracy",
    validate: (v) => (!v || v.length < 3 ? "Too short" : undefined),
  });
  if (p.isCancel(goal)) return;

  // Prompt file
  const prompt = await p.text({
    message: "What file is the prompt? (path relative to this directory)",
    placeholder: "e.g., prompt.md",
    validate: (v) => (!v || v.length < 1 ? "Required" : undefined),
  });
  if (p.isCancel(prompt)) return;

  // Test cases
  const testCases = await p.text({
    message: "Where are your test cases? (path to JSON file)",
    placeholder: "e.g., test_cases.json",
    validate: (v) => (!v || v.length < 1 ? "Required" : undefined),
  });
  if (p.isCancel(testCases)) return;

  // Eval criteria
  const criteriaInput = await p.text({
    message: "Eval criteria with weights (comma-separated)",
    placeholder: "e.g., Correct classification (70%), Valid JSON output (15%), Confidence 0-1 (15%)",
    validate: (v) => (!v || v.length < 3 ? "Need at least one criterion" : undefined),
  });
  if (p.isCancel(criteriaInput)) return;

  const criteria = (criteriaInput as string)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  // Constraints
  const constraintsInput = await p.text({
    message: "Any constraints? (comma-separated, or leave empty)",
    placeholder: "e.g., Must keep the {{input}} placeholder, Must remain under 500 tokens",
    initialValue: "",
  });
  if (p.isCancel(constraintsInput)) return;

  const constraints = (constraintsInput as string)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  // Context files
  const contextInput = await p.text({
    message: "Any context files the agent should read? (comma-separated paths, or leave empty)",
    placeholder: "e.g., test_cases.json, docs/spec.md",
    initialValue: "",
  });
  if (p.isCancel(contextInput)) return;

  const contextFiles = (contextInput as string)
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  // Create output directory structure
  await mkdir(join(cwd, BEST_DIR), { recursive: true });
  await mkdir(join(cwd, SNAPSHOTS_DIR), { recursive: true });

  // Build RATCHET.md
  const constraintsSection =
    constraints.length > 0
      ? constraints.map((c) => `- ${c}`).join("\n")
      : "- (none specified)";

  const criteriaSection = criteria.map((c) => `- ${c}`).join("\n");

  const contextSection =
    contextFiles.length > 0
      ? `\n# Context\n${contextFiles.map((f) => `- Read ${f}`).join("\n")}\n`
      : "";

  const ratchetMd = `# Goal
${goal}

# Prompt
${prompt}

# Constraints
${constraintsSection}

# Eval
- Test cases: ${testCases}
${criteriaSection}
${contextSection}`;

  await Bun.write(join(cwd, RATCHET_MD), ratchetMd);

  // Initialize empty progress log
  const logPath = join(cwd, PROGRESS_LOG);
  if (!(await Bun.file(logPath).exists())) {
    await Bun.write(logPath, "");
  }

  // Snapshot initial prompt state
  try {
    const promptContent = await Bun.file(join(cwd, prompt as string)).text();
    const bestFileName = (prompt as string).split("/").pop() || "prompt";
    await Bun.write(join(cwd, BEST_DIR, bestFileName), promptContent);
  } catch {
    p.log.warn(`Could not snapshot prompt at ${prompt}. Make sure the file exists before running.`);
  }

  p.outro(`Ready. Run \`ratchet start\` to begin.`);
}
