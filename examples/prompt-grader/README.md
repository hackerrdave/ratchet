# Prompt Grader Example

Sentiment classification prompt optimized with ratchet.

## Structure

```
prompt.md          # The prompt ratchet optimizes
test_cases.json    # Labeled test data (input + expected output)
RATCHET.md         # Everything else: goal, constraints, eval criteria
.ratchet/          # Generated output (gitignored in real projects)
```

That's it. Three files.

## Running

```bash
cd examples/prompt-grader

# Phase 1: Optimize quality
ratchet start -n 15

# Inspect token breakdown
ratchet tokens
ratchet tokens -m stats

# Phase 2: Compress for token efficiency
ratchet compress -n 10

# Review the full story
ratchet log
```

## What's included

The `.ratchet/` dir contains reference output from a previous run.
Delete it to start fresh.
