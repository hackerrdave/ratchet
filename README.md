# Ratchet

Agentic prompt optimization with high watermarking. Ratchet uses an LLM proposer to iteratively improve a prompt, scores each change with a built-in LLM judge, and only keeps changes that beat the current high watermark. Like a ratchet wrench — it only moves forward.

Then it compresses the prompt for token efficiency while keeping quality above a configurable bar.

## How It Works

```
┌───────────┐     ┌────────┐     ┌─────────┐     ┌───────────┐
│ Proposer  │────▶│ Prompt │────▶│  Judge  │────▶│ Watermark │
│ (Claude)  │     │ (.md)  │     │ (Claude)│     │   check   │
└───────────┘     └────────┘     └─────────┘     └───────────┘
      ▲                                                │
      │              ✓ kept (score > watermark)        │
      └────────────────────────────────────────────────┘
                     ✗ discarded (rollback)
```

**Proposer** — Claude reads your RATCHET.md spec, the current prompt, progress history, and learnings, then suggests one targeted change.

**Judge** — The built-in LLM judge runs the modified prompt against your test cases, then scores each response against your eval criteria. No custom scorer code needed.

**Watermark** — If the score beats the current watermark by at least `--min-delta`, the change is kept. Otherwise it's rolled back.

## A Prompt Project is Three Files

```
prompt.md          ← the prompt being optimized
test_cases.json    ← inputs + expected outputs
RATCHET.md         ← goal, constraints, eval criteria
```

That's it. Ratchet handles everything else.

## Quick Start

```bash
# Install
git clone git@github.com:hackerrdave/ratchet.git
cd ratchet && bun install

# Link globally
bun link

# Go to an example
cd examples/commit-writer
export ANTHROPIC_API_KEY="sk-ant-..."

# Phase 1: Optimize quality
ratchet start -n 10

# Inspect the prompt's tokenization
ratchet tokens -m stats

# Phase 2: Compress for token efficiency
ratchet compress -n 5

# Review everything
ratchet log
ratchet learnings
```

## RATCHET.md

One file configures both sides of the loop — the proposer and the judge:

```markdown
# Goal
Improve the commit message prompt to generate accurate conventional commits.

# Prompt
prompt.md

# Constraints
- Must keep the {{diff}} placeholder
- Must output only the commit message, no explanation
- Must use conventional commit format (type: description)

# Eval
- Test cases: test_cases.json
- Target: claude-haiku-4-5-20251001
- Correct commit type (30%)
- Accurately describes the change (40%)
- Conventional commit format with no extra text (15%)
- Concise — single line, under 72 characters (15%)

# Context
- Read test_cases.json to see the range of diffs and expected messages
```

| Section | Purpose |
|---------|---------|
| **Goal** | What "better" means — fed to the proposer |
| **Prompt** | The file being optimized (the only file ratchet modifies) |
| **Constraints** | Rules the proposer must follow |
| **Eval** | Test cases, target model, and scoring criteria for the judge |
| **Context** | Additional files the proposer should read |

### Eval Section

- **Test cases** — Path to a JSON file: `[{"field": "value", "expected": "..."}, ...]`. All fields except `expected` get substituted into the prompt as `{{field}}`. The judge compares LLM output against `expected`.
- **Target** — The model your prompt is designed for. Runs test cases and judges output. Optional — defaults to haiku.
- **Criteria** — Natural language scoring criteria with optional percentage weights. The judge evaluates all criteria for each test case and computes a weighted score.

## Commands

### `ratchet start` — Quality Phase

```bash
ratchet start -n 20 --model claude-haiku-4-5-20251001
```

| Option | Default | Description |
|--------|---------|-------------|
| `-n, --iterations` | 20 | Number of iterations |
| `--min-delta` | 0.001 | Minimum improvement to accept |
| `--model` | claude-haiku-4-5-20251001 | Proposer model |
| `--judge-model` | (target model) | Override judge model |
| `--fresh` | — | Start fresh, ignore saved state |
| `--max-spend` | — | Budget cap in USD |

Each iteration shows a spinner while proposing and judging, then a structured result:

```
  Ratchet [a1b2c3d4]
  ──────────────────────────────────────────────────
  Prompt               prompt.md  24 tokens ($0.0000/call)
  Test cases           test_cases.json
  Proposer             claude-haiku-4-5-20251001
  Iterations           10
  Watermark            0.7500

  ⠹ [1/10] Proposing (3.2s)
  ✓ [1/10] Proposing (4.1s)
  ⠹ [1/10] Judging (test_cases.json) (5.1s)
  ✓ [1/10] Judging (test_cases.json) (8.3s)
  [1/10] ✓ kept  0.8200 (+0.0700) │ 48tok │ $0.0034 │ 12.3s
         Add explicit type prefix examples for common patterns

  [2/10] ✗ disc  0.7900 (-0.0300) │ 62tok │ $0.0041 │ 14.1s
         Add instruction to analyze file extensions

  Done
  ──────────────────────────────────────────────────
  Kept                 4
  Discarded            6
  Watermark            0.8650
  Total spend          $0.0382
```

### `ratchet compress` — Efficiency Phase

Optimize token count while keeping quality within a margin:

```bash
ratchet compress -n 10 --quality-margin 0.03
```

| Option | Default | Description |
|--------|---------|-------------|
| `-n, --iterations` | 10 | Compression attempts |
| `--model` | claude-haiku-4-5-20251001 | Proposer model |
| `--judge-model` | (target model) | Override judge model |
| `--quality-bar` | (current watermark) | Quality score to protect |
| `--quality-margin` | 0.03 | Acceptable quality drop |
| `--min-token-reduction` | 0.10 | Required token savings to justify any quality drop |
| `--max-spend` | — | Budget cap in USD |

Acceptance criteria:
- Quality must stay ≥ quality bar − margin
- Tokens must decrease
- If quality drops: token reduction must be ≥ 10% (configurable)

### `ratchet tokens` — Visualize Tokenization

See how the LLM tokenizes your prompt:

```bash
ratchet tokens              # color mode (default)
ratchet tokens -m stats     # aggregate breakdown
ratchet tokens -m heatmap   # efficiency heatmap
ratchet tokens -m boundary  # pipe-delimited tokens
ratchet tokens -m ids       # token ID table
ratchet tokens -f any.md    # any file, not just the prompt
```

Stats mode shows token distribution, most common tokens, chars/token ratio, and cost projections at various call volumes.

### `ratchet log` — Iteration History

```bash
ratchet log
```

```
  Ratchet log
  ──────────────────────────────────────────────────
  Iterations           10 (7 kept, 3 discarded)
  Total cost           $0.01
  Model                claude-haiku-4-5-20251001
  Score                0.7800 → 0.8900

    1 ✓ 0.8200 +0.0400 │ 482tok │ $0.0012 │ quality
      Add structured output format with JSON schema
    2 ✗ 0.8100 -0.0100 │ 531tok │ $0.0014 │ quality
      Add chain-of-thought reasoning section
    ...
    1 ✓ 0.8850 -0.0050 │ 580tok │ $0.0015 │ efficiency
      Merge redundant JSON instructions into single block

  Token trajectory
  ──────────────────────────────────────────────────
  Tokens               482 → 465 (-17, -3.5%)
                       ▂▅▆█▅▃▁
  Quality              482 → 648 tokens (4 kept)
  Efficiency           580 → 465 tokens (3 kept)
```

### `ratchet learnings` — What Worked and What Didn't

```bash
ratchet learnings
```

After each run, Claude extracts tactical learnings from the progress log. These are formatted with section icons and word-wrapped explanations, and fed back to the proposer on subsequent runs.

### Other Commands

```bash
ratchet init              # Scaffold RATCHET.md interactively
ratchet watch             # Live staircase chart during a run
ratchet diff 1 3          # Diff prompt between two kept iterations
ratchet show 3            # Print prompt at a specific iteration
ratchet checkout 3        # Restore prompt to a specific iteration
ratchet pause             # Stop after current iteration
ratchet resume            # Clear pause flag
```

## Models

Three distinct model roles:

| Role | Set by | Purpose |
|------|--------|---------|
| **Proposer** | `--model` flag | The optimizer that suggests prompt changes |
| **Target** | `Target:` in RATCHET.md `# Eval` | The model your prompt is *for*. Runs test cases and (by default) judges output. |
| **Judge** | `--judge-model` flag | Scores responses against criteria. Defaults to target model. |

Use a cheap proposer with a smarter judge:

```bash
ratchet start --model claude-haiku-4-5-20251001 --judge-model claude-sonnet-4-20250514
```

Both models are recorded in every progress entry so you always know what produced the results.

## Project Layout

```
my-prompt/
  prompt.md              ← your prompt (the thing ratchet optimizes)
  test_cases.json        ← inputs + expected outputs
  RATCHET.md             ← config: goal, constraints, eval criteria
  .ratchet/              ← all generated output (gitignore this)
    watermark.txt        ←   current high watermark
    progress.log         ←   JSONL iteration history
    learnings.md         ←   extracted tactical learnings
    state.json           ←   resume checkpoint (deleted on completion)
    best/prompt.md       ←   best prompt so far
    snapshots/           ←   prompt at each kept iteration
      1/prompt.md
      3/prompt.md
      ...
```

Add `.ratchet/` to your `.gitignore`. The only files you author are `prompt.md`, `test_cases.json`, and `RATCHET.md`.

## Examples

### Prompt Grader

Sentiment classification — optimize a prompt for accuracy, valid JSON, and confidence scores.

```bash
cd examples/prompt-grader
ratchet start -n 15
```

### Commit Writer

Generate conventional commit messages from git diffs.

```bash
cd examples/commit-writer
ratchet start -n 10
```

## Installation

### Prerequisites

- [Bun](https://bun.sh) v1.0+
- An [Anthropic API key](https://console.anthropic.com/)

### From Source

```bash
git clone git@github.com:hackerrdave/ratchet.git
cd ratchet
bun install
bun link   # makes `ratchet` available globally
```

### Compile to Binary

```bash
bun run build           # ./dist/ratchet
bun run build:all       # macOS, Linux, Windows
```

## Development

```bash
bun run src/cli.ts <command>   # run in dev
bun test                       # 86 tests
bun run typecheck              # type check
```

## License

MIT
