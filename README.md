# Ratchet

Agentic optimization loop with high watermarking. Ratchet uses Claude to iteratively improve a single file (the "lever") against a scorer, accepting only changes that beat the current high watermark. Like a ratchet wrench — it only moves forward.

## How It Works

```
┌─────────┐     ┌───────┐     ┌────────┐     ┌──────────┐
│  Agent   │────▶│ Lever │────▶│ Scorer │────▶│ Watermark│
│ (Claude) │     │ (file)│     │ (sh)   │     │  check   │
└─────────┘     └───────┘     └────────┘     └──────────┘
     ▲                                            │
     │            ✓ kept (score > watermark)       │
     └────────────────────────────────────────────┘
                  ✗ discarded (rollback)
```

Each iteration, Claude proposes a single targeted change to the lever file. The scorer evaluates the result and produces a numeric score. If the score exceeds the current watermark by at least `--min-delta`, the change is kept and the watermark ratchets up. Otherwise, the change is rolled back. Progress is logged and snapshots are saved for every accepted iteration.

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- An [Anthropic API key](https://console.anthropic.com/)

### From Source

```bash
git clone git@github.com:hackerrdave/ratchet.git
cd ratchet
bun install
```

Run directly with Bun:

```bash
bun run src/cli.ts <command>
```

Or compile to a standalone binary:

```bash
bun run build
./dist/ratchet <command>
```

### Cross-Platform Builds

```bash
bun run build:all
# Produces:
#   dist/ratchet-macos    (darwin-arm64)
#   dist/ratchet-linux    (linux-x64)
#   dist/ratchet-windows.exe
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |

### `ratchet init`

Run `ratchet init` in your project root to set everything up interactively. It walks you through:

1. **Scorer type** — how you'll measure improvement:
   - **Objective** — a test suite, build script, latency benchmark, or any command that outputs a score
   - **Labeled** — you label example pairs (match/no-match), Ratchet builds a scorer from them
   - **Live signal** — a metrics endpoint or DB query that returns a live score
   - **LLM judge** — uses a model to evaluate outputs *(weakest anchor — scores may drift)*

2. **Goal** — one sentence describing what you're optimizing for

3. **Lever** — the file path Claude is allowed to modify (e.g., `prompts/classifier.md`)

4. **Constraints** — rules Claude must follow (e.g., "Must remain under 2000 tokens")

5. **Context files** — additional files Claude should read for background

This generates:

| File | Purpose |
|---|---|
| `RATCHET.md` | Optimization spec — goal, lever, constraints, context |
| `scorer.sh` | Shell script that outputs a single float (higher = better) |
| `ratchet/watermark.txt` | Current high watermark score |
| `ratchet/progress.log` | JSONL log of every iteration |
| `ratchet/best/` | Latest best version of the lever |
| `ratchet/snapshots/` | Snapshot of the lever at each kept iteration |

### `RATCHET.md`

The generated spec file looks like this:

```markdown
# Goal
Improve prompt accuracy for product-recall matching

# Lever
The file at prompts/classifier.md is the only thing you may change.
One targeted improvement per iteration. Do not rewrite wholesale.

# Constraints
- Must remain under 2000 tokens
- Must not remove the routing section

# Context
- Read TOPOLOGY.md for codebase structure
- The scorer measures how well the lever achieves the goal above
```

### `scorer.sh`

Your scorer must output a **single float to stdout**. Higher is better. Example:

```bash
#!/bin/bash
# Run tests and report pass rate
TOTAL=$(bun test 2>&1 | grep -oP '\d+ pass' | grep -oP '\d+')
FAILED=$(bun test 2>&1 | grep -oP '\d+ fail' | grep -oP '\d+')
echo "scale=4; $TOTAL / ($TOTAL + $FAILED)" | bc
```

## Usage

### Start an Optimization Run

```bash
# Run 20 iterations with defaults
ratchet start

# Customize the run
ratchet start --iterations 50 --min-delta 0.01 --model claude-haiku-4-20250414
```

| Option | Default | Description |
|---|---|---|
| `-n, --iterations <n>` | `20` | Number of iterations to run |
| `--min-delta <delta>` | `0.001` | Minimum score improvement to accept a change |
| `--model <model>` | `claude-haiku-4-20250414` | Claude model to use |
| `--schedule <cron>` | — | Cron schedule for recurring runs (coming soon) |

Output looks like:

```
Starting ratchet loop
  Lever: prompts/classifier.md
  Model: claude-haiku-4-20250414
  Iterations: 20
  Min delta: 0.001
  Current watermark: 0.72

[1/20] Running agent... scoring... ✓ kept  score=0.7400 (+0.0200) — Added few-shot example for edge case
[2/20] Running agent... scoring... ✗ disc  score=0.7350 (-0.0050) — Restructured output format
[3/20] Running agent... scoring... ✓ kept  score=0.7650 (+0.0250) — Clarified matching criteria
...

Done. 8 kept, 12 discarded. Final watermark: 0.8420
```

### Watch Live Progress

```bash
ratchet watch
```

Displays a live staircase chart in the terminal showing score progression, watermark level, and accept/discard history. Refreshes every 2 seconds.

### View Iteration History

```bash
ratchet log
```

```
   #  Status      Score     Delta  Timestamp                 Summary
────────────────────────────────────────────────────────────────────────────
   1  ✓ kept     0.7400   +0.0200  2026-03-10T12:00:00.000Z  Added few-shot example
   2  ✗ disc     0.7350   -0.0050  2026-03-10T12:01:30.000Z  Restructured output format
   3  ✓ kept     0.7650   +0.0250  2026-03-10T12:03:00.000Z  Clarified matching criteria

3 iterations, 2 kept, 1 discarded
```

### Compare Iterations

```bash
# Diff the lever between two kept iterations
ratchet diff 1 3
```

Shows a unified diff of the lever file between any two snapshots.

### Inspect a Specific Iteration

```bash
ratchet show 3
```

### Restore a Previous State

```bash
# Roll the lever back to iteration 3's state
ratchet checkout 3
```

### Pause and Resume

```bash
# Pause a running optimization (checked between iterations)
ratchet pause

# Resume where you left off
ratchet resume
```

## Example: Optimizing a Classifier Prompt

```bash
# 1. Set up your project
mkdir my-project && cd my-project
echo "Classify the product..." > prompts/classifier.md

# 2. Write a scorer
cat > scorer.sh << 'EOF'
#!/bin/bash
python3 eval.py prompts/classifier.md | tail -1
EOF
chmod +x scorer.sh

# 3. Initialize ratchet
export ANTHROPIC_API_KEY="sk-ant-..."
ratchet init
# → Select "Objective" scorer type
# → Goal: "Improve classification accuracy"
# → Lever: prompts/classifier.md

# 4. Run the optimization loop
ratchet start --iterations 30

# 5. Watch it climb
ratchet watch
```

## Project Structure

```
your-project/
├── RATCHET.md              # Optimization spec
├── scorer.sh               # Scoring script
├── prompts/
│   └── classifier.md       # The lever (file being optimized)
└── ratchet/
    ├── watermark.txt        # Current high watermark
    ├── progress.log         # JSONL iteration history
    ├── labeled_set.json     # Labeled examples (if using labeled scorer)
    ├── best/
    │   └── classifier.md    # Best lever state so far
    └── snapshots/
        ├── 1/
        │   └── classifier.md
        ├── 3/
        │   └── classifier.md
        └── ...              # One snapshot per kept iteration
```

## License

MIT
