import { WATERMARK_FILE } from "./config.ts";
import { join } from "path";

export async function readWatermark(cwd: string): Promise<number> {
  const path = join(cwd, WATERMARK_FILE);
  try {
    const content = await Bun.file(path).text();
    return parseFloat(content.trim());
  } catch {
    return -Infinity;
  }
}

export async function writeWatermark(cwd: string, score: number): Promise<void> {
  const path = join(cwd, WATERMARK_FILE);
  await Bun.write(path, score.toString());
}
