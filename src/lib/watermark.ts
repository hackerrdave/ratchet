import { watermarkPath, DEFAULT_NAME } from "./config.ts";
import { join } from "path";

export async function readWatermark(cwd: string, name: string = DEFAULT_NAME): Promise<number> {
  const path = join(cwd, watermarkPath(name));
  try {
    const content = await Bun.file(path).text();
    return parseFloat(content.trim());
  } catch {
    return -Infinity;
  }
}

export async function writeWatermark(cwd: string, score: number, name: string = DEFAULT_NAME): Promise<void> {
  const path = join(cwd, watermarkPath(name));
  await Bun.write(path, score.toString());
}
