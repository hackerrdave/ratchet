import { readLearnings } from "../lib/learnings.ts";
import { c } from "../lib/format.ts";

export async function learningsCommand() {
  const cwd = process.cwd();
  const learnings = await readLearnings(cwd);

  if (!learnings) {
    console.log("No learnings yet. Run `ratchet start` first.");
    return;
  }

  console.log();
  renderMarkdown(learnings);
}

const SECTION_ICONS: Record<string, string> = {
  "what works": `${c.green}▲${c.reset}`,
  "what doesn't": `${c.red}▼${c.reset}`,
  "tactics": `${c.cyan}◆${c.reset}`,
};

function renderMarkdown(md: string) {
  const lines = md.split("\n");

  for (const line of lines) {
    // # Title
    const h1 = line.match(/^#\s+(.+)/);
    if (h1 && !line.startsWith("##")) {
      console.log(`  ${c.bold}${h1[1]}${c.reset}`);
      console.log(`  ${c.dim}${"─".repeat(60)}${c.reset}`);
      continue;
    }

    // ## Section heading
    const h2 = line.match(/^##\s+(.+)/);
    if (h2) {
      const key = h2[1]!.toLowerCase();
      const icon = SECTION_ICONS[key] || `${c.blue}●${c.reset}`;
      console.log();
      console.log(`  ${icon} ${c.bold}${h2[1]}${c.reset}`);
      console.log();
      continue;
    }

    // - **Bold lead** — rest of text
    const bullet = line.match(/^[-*]\s+\*\*(.+?)\*\*\s*[—–-]\s*(.*)/);
    if (bullet) {
      console.log(`    ${c.dim}•${c.reset} ${c.bold}${bullet[1]}${c.reset}`);
      // Wrap the explanation text
      const explanation = bullet[2]!;
      const wrapped = wordWrap(explanation, 70);
      for (const wline of wrapped) {
        console.log(`      ${c.dim}${wline}${c.reset}`);
      }
      console.log();
      continue;
    }

    // - Plain bullet
    const plainBullet = line.match(/^[-*]\s+(.*)/);
    if (plainBullet) {
      const text = plainBullet[1]!.replace(/\*\*(.+?)\*\*/g, `${c.bold}$1${c.reset}${c.dim}`);
      console.log(`    ${c.dim}•${c.reset} ${c.dim}${text}${c.reset}`);
      continue;
    }

    // Empty line
    if (line.trim() === "") continue;

    // Anything else — just print dimmed
    console.log(`  ${c.dim}${line}${c.reset}`);
  }
  console.log();
}

function wordWrap(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > width && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
