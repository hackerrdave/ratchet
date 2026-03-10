import { $ } from "bun";

export async function runScorer(scorerPath: string, cwd: string): Promise<number> {
  try {
    const result = await $`bash ${scorerPath}`.cwd(cwd).text();
    const score = parseFloat(result.trim().split("\n").pop() || "");
    if (isNaN(score)) {
      throw new Error(`Scorer did not return a valid float. Output: ${result.trim()}`);
    }
    return score;
  } catch (err) {
    if (err instanceof Error && err.message.includes("did not return")) throw err;
    throw new Error(`Scorer failed: ${err}`);
  }
}
